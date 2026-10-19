import PostalMime from "postal-mime";
import { LANDING_HTML } from "./landing.js";
import { GUIDES, GUIDE_SLUGS } from "./guides.js";
import { COMPARE, COMPARE_SLUGS } from "./compare.js";
import { FAQ_HTML } from "./faq.js";
import { ICON_PNG_BASE64, ICON_SVG } from "./icon.js";
import {
  type BillingEnv,
  PAID_CREATES_PER_MINUTE,
  PAID_MAX_TTL_MINUTES,
  deliverWebhook,
  deriveApiKey,
  extractOtp,
  handleStripeWebhook,
  lookupActiveKey,
  sha256Hex,
  validateWebhookUrl,
} from "./billing.js";

export interface Env extends BillingEnv {
  DB: D1Database;
  API_TOKEN: string;
}

const DOMAIN = "receivemail.dev";
const DEFAULT_TTL_MINUTES = 15;
const MAX_TTL_MINUTES = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CREATES = 20;
const DAILY_GLOBAL_MAX_CREATES = 5_000;
const PRO_INTEREST_PER_IP_PER_HOUR = 5;
const PRO_FEATURES = ["private_domain", "higher_limits", "longer_retention", "webhooks", "html_attachments"];
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Our own health checks and self-tests send mail from these — excluded from
// the "external" usage numbers in daily_stats.
const OWN_SENDER_DOMAINS = ["flo-voice1.com", "ducemgunoiul.ro"];

function randomAddress(): string {
  const local = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${local}@${DOMAIN}`;
}

function randomSecret(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

// Plain `!==` on secrets is a timing side-channel (response time leaks how
// many leading bytes matched) — compare byte-by-byte over the whole length
// instead, same rationale as safeCompare() in the main app.
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

function notFound(): Response {
  return new Response(JSON.stringify({ error: "not found" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Same fixed-window shape as checkCreateRateLimit below, one-hour window.
async function checkHourlyIpLimit(env: Env, key: string, max: number): Promise<boolean> {
  const now = Date.now();
  const row = await env.DB.prepare(`SELECT window_start, count FROM rate_limits WHERE bucket_key = ?`)
    .bind(key)
    .first<{ window_start: number; count: number }>();
  if (!row || now - row.window_start > 60 * 60_000) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (bucket_key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(bucket_key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
    )
      .bind(key, now)
      .run();
    return true;
  }
  if (row.count >= max) return false;
  await env.DB.prepare(`UPDATE rate_limits SET count = count + 1 WHERE bucket_key = ?`).bind(key).run();
  return true;
}

function tooManyRequests(): Response {
  return new Response(JSON.stringify({ error: "rate limited, try again shortly" }), {
    status: 429,
    headers: { "content-type": "application/json" },
  });
}

// ip-api.com's free /batch endpoint (HTTP only on the free tier, no key
// needed): up to 100 IPs per call, 45 req/min — called once/day from the
// cron, not from the hot create path, so this never adds latency to a real
// request. Classifies an IP as "bot-ish" if it's a known proxy or a
// datacenter/hosting range — real residential/mobile traffic is neither.
// Best-effort: a lookup failure just leaves that IP unclassified (counted
// as real), never blocks or fails the stats snapshot.
async function classifyBotIps(ips: string[]): Promise<Set<string>> {
  const bad = new Set<string>();
  for (let i = 0; i < ips.length; i += 100) {
    const batch = ips.slice(i, i + 100);
    try {
      const res = await fetch("http://ip-api.com/batch?fields=query,proxy,hosting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(batch),
      });
      const results = (await res.json()) as Array<{ query: string; proxy?: boolean; hosting?: boolean }>;
      for (const r of results) {
        if (r.proxy || r.hosting) bad.add(r.query);
      }
    } catch (err) {
      console.error("classifyBotIps batch failed", err);
    }
  }
  return bad;
}

// Fixed-window counter in D1. Not perfectly atomic under heavy concurrent
// load from the same IP (read-then-write race, same class of accepted risk
// as the sms-florin free-rental per-IP guard) — fine for the current low
// traffic; revisit with a Durable Object only if this is ever actually
// abused at volume.
// Snapshot one UTC day into daily_stats. Must run before scheduled() prunes:
// the cron fires at 03:00 UTC, when all of yesterday's mail and its
// create:daily bucket still exist (mailboxes created yesterday, max 60min
// TTL, are already past expires_at but not yet deleted — that happens later
// in scheduled()). INSERT OR REPLACE so a re-run is harmless.
async function recordDailyStats(env: Env, day: string): Promise<void> {
  const created = await env.DB.prepare(`SELECT count FROM rate_limits WHERE bucket_key = ?`)
    .bind(`create:daily:${day}`)
    .first<{ count: number }>();

  const ownFilter = OWN_SENDER_DOMAINS.map(() => `from_address NOT LIKE ?`).join(" AND ");
  const ownArgs = OWN_SENDER_DOMAINS.map((d) => `%@%${d}`);

  const totals = await env.DB.prepare(
    `SELECT count(*) AS n FROM emails WHERE date(received_at) = ?`,
  )
    .bind(day)
    .first<{ n: number }>();

  const external = await env.DB.prepare(
    `SELECT count(*) AS n, count(DISTINCT mailbox) AS boxes FROM emails
     WHERE date(received_at) = ? AND ${ownFilter}`,
  )
    .bind(day, ...ownArgs)
    .first<{ n: number; boxes: number }>();

  const { results: senders } = await env.DB.prepare(
    `SELECT lower(substr(from_address, instr(from_address, '@') + 1)) AS domain, count(*) AS n
     FROM emails WHERE date(received_at) = ? AND ${ownFilter}
     GROUP BY domain ORDER BY n DESC LIMIT 15`,
  )
    .bind(day, ...ownArgs)
    .all<{ domain: string; n: number }>();

  // Bot/VPN classification — done in JS (not a SQL IN(...) with one bound
  // param per IP) to sidestep D1's bound-parameter cap, which a bad day
  // could exceed. Pulls every mailbox created today with its creator_ip
  // (captured at POST /mailboxes time), classifies the distinct IPs once,
  // then counts in memory.
  const { results: dayMailboxes } = await env.DB.prepare(
    `SELECT address, creator_ip FROM mailboxes WHERE date(created_at) = ? AND creator_ip IS NOT NULL`,
  )
    .bind(day)
    .all<{ address: string; creator_ip: string }>();

  let suspectedBotMailboxes = 0;
  let suspectedBotExternalEmails = 0;
  if (dayMailboxes.length > 0) {
    const distinctIps = [...new Set(dayMailboxes.map((m) => m.creator_ip))];
    const badIps = await classifyBotIps(distinctIps);
    if (badIps.size > 0) {
      const botAddresses = new Set(
        dayMailboxes.filter((m) => badIps.has(m.creator_ip)).map((m) => m.address),
      );
      suspectedBotMailboxes = botAddresses.size;

      if (botAddresses.size > 0) {
        const { results: dayExternalEmails } = await env.DB.prepare(
          `SELECT mailbox FROM emails WHERE date(received_at) = ? AND ${ownFilter}`,
        )
          .bind(day, ...ownArgs)
          .all<{ mailbox: string }>();
        suspectedBotExternalEmails = dayExternalEmails.filter((e) => botAddresses.has(e.mailbox)).length;
      }
    }
  }

  // Reddit verification codes are counted separately: on 2026-10-19 they were
  // ~91% of external mail, so the plain external_emails total overstates real
  // usage. See schema_v8.sql.
  const redditCodes = await env.DB.prepare(
    `SELECT count(*) AS n FROM emails
     WHERE date(received_at) = ? AND subject LIKE '%Reddit verification%' AND ${ownFilter}`,
  )
    .bind(day, ...ownArgs)
    .first<{ n: number }>();

  await env.DB.prepare(
    `INSERT OR REPLACE INTO daily_stats
       (day, mailboxes_created, emails_received, external_emails, mailboxes_with_mail, top_sender_domains,
        suspected_bot_mailboxes, suspected_bot_external_emails, reddit_code_emails)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      day,
      created?.count ?? 0,
      totals?.n ?? 0,
      external?.n ?? 0,
      external?.boxes ?? 0,
      JSON.stringify(senders.map((s) => [s.domain, s.n])),
      suspectedBotMailboxes,
      suspectedBotExternalEmails,
      redditCodes?.n ?? 0,
    )
    .run();
}

async function checkCreateRateLimit(env: Env, ip: string): Promise<boolean> {
  const now = Date.now();
  const key = `create:ip:${ip}`;
  const row = await env.DB.prepare(
    `SELECT window_start, count FROM rate_limits WHERE bucket_key = ?`,
  )
    .bind(key)
    .first<{ window_start: number; count: number }>();

  if (!row || now - row.window_start > RATE_LIMIT_WINDOW_MS) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (bucket_key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(bucket_key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
    )
      .bind(key, now)
      .run();
    return true;
  }

  if (row.count >= RATE_LIMIT_MAX_CREATES) return false;

  await env.DB.prepare(`UPDATE rate_limits SET count = count + 1 WHERE bucket_key = ?`)
    .bind(key)
    .run();
  return true;
}

// Paid keys skip the per-IP and daily global caps (those exist to protect
// the free tier from anonymous abuse) and get their own, higher per-key
// limit instead — same fixed-window shape, keyed by the key's hash.
async function checkKeyCreateLimit(env: Env, keyHash: string): Promise<boolean> {
  const now = Date.now();
  const key = `create:key:${keyHash}`;
  const row = await env.DB.prepare(`SELECT window_start, count FROM rate_limits WHERE bucket_key = ?`)
    .bind(key)
    .first<{ window_start: number; count: number }>();
  if (!row || now - row.window_start > RATE_LIMIT_WINDOW_MS) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (bucket_key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(bucket_key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
    )
      .bind(key, now)
      .run();
    return true;
  }
  if (row.count >= PAID_CREATES_PER_MINUTE) return false;
  await env.DB.prepare(`UPDATE rate_limits SET count = count + 1 WHERE bucket_key = ?`).bind(key).run();
  return true;
}

// A second, coarser ceiling across ALL callers combined — the per-IP limit
// above stops one abusive IP, but not many distinct IPs hammering the
// endpoint at once. 5,000/day is generous for real usage but caps worst-case
// D1 write volume (and the free tier's daily write budget) if this is ever
// actually targeted. Bucketed by UTC calendar day.
async function checkDailyGlobalLimit(env: Env): Promise<boolean> {
  const dayKey = new Date().toISOString().slice(0, 10);
  const key = `create:daily:${dayKey}`;
  const row = await env.DB.prepare(`SELECT count FROM rate_limits WHERE bucket_key = ?`)
    .bind(key)
    .first<{ count: number }>();

  if (!row) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (bucket_key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(bucket_key) DO UPDATE SET count = count + 1`,
    )
      .bind(key, Date.now())
      .run();
    return true;
  }

  if (row.count >= DAILY_GLOBAL_MAX_CREATES) return false;

  await env.DB.prepare(`UPDATE rate_limits SET count = count + 1 WHERE bucket_key = ?`)
    .bind(key)
    .run();
  return true;
}

// A request may read a mailbox either with the global admin token (Florin's
// own access) or with that specific mailbox's own secret, returned once at
// creation time — the per-mailbox capability model. No account/user table
// needed: holding the secret *is* the ownership proof.
async function canReadMailbox(
  env: Env,
  request: Request,
  address: string,
): Promise<boolean> {
  const authHeader = request.headers.get("authorization") ?? "";
  const presented = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!presented) return false;

  if (safeCompare(presented, env.API_TOKEN)) return true;

  const mailbox = await env.DB.prepare(
    `SELECT secret FROM mailboxes WHERE address = ?`,
  )
    .bind(address)
    .first<{ secret: string | null }>();

  if (!mailbox?.secret) return false;
  return safeCompare(presented, mailbox.secret);
}

const PAGE_HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex">`;
const PAGE_STYLE = `<link rel="icon" type="image/svg+xml" href="/icon.svg"><style>body{margin:0;background:#0b0d10;color:#e8eaed;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:1.5rem}main{max-width:640px}a{color:#5eead4}code,pre{font-family:ui-monospace,Menlo,monospace;background:#151a20;border-radius:6px}code{padding:.15rem .35rem}pre{padding:.9rem;overflow-x:auto;font-size:.85rem}.key{font-size:1.05rem;word-break:break-all;color:#5eead4}</style></head><body><main>`;
const PAGE_END = `<p><a href="/">← back to receivemail.dev</a></p></main></body></html>`;
const KEY_REVEAL_WINDOW_MS = 24 * 60 * 60_000;

function htmlPage(title: string, body: string, extraHead = ""): Response {
  return new Response(`${PAGE_HEAD}<title>${title} — receivemail.dev</title>${extraHead}${PAGE_STYLE}${body}${PAGE_END}`, {
    headers: { "content-type": "text/html;charset=utf-8", "cache-control": "no-store" },
  });
}

async function proThanksPage(env: Env, sessionId: string | null): Promise<Response> {
  if (!sessionId || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) {
    return htmlPage("Thanks", `<h1>Thanks!</h1><p>If you just subscribed, open the link Stripe redirected you to — it carries your session and shows your API key.</p>`);
  }
  const row = await env.DB.prepare(
    `SELECT tier, status, created_at FROM api_keys WHERE stripe_session_id = ?`,
  )
    .bind(sessionId)
    .first<{ tier: string; status: string; created_at: string }>();

  if (!row) {
    return htmlPage(
      "Finishing up",
      `<h1>Finishing up…</h1><p>Payment received — your API key is being issued. This page refreshes on its own in a few seconds.</p><p style="color:#9aa0a6">Still here after a minute? Email flovoice53@gmail.com with your Stripe receipt and we'll sort it out.</p>`,
      `<meta http-equiv="refresh" content="4">`,
    );
  }

  const createdMs = Date.parse(`${row.created_at.replace(" ", "T")}Z`);
  if (row.status !== "active" || Date.now() - createdMs > KEY_REVEAL_WINDOW_MS) {
    return htmlPage(
      "Subscription",
      `<h1>Subscription found</h1><p>For security, the API key is only shown here for 24 hours after purchase. Lost it? Email flovoice53@gmail.com with your Stripe receipt for a new one.</p>`,
    );
  }

  const key = await deriveApiKey(env, sessionId);
  const webhooks = row.tier === "webhooks";
  const createExample = webhooks
    ? `curl -X POST https://receivemail.dev/mailboxes \\
  -H "Authorization: Bearer ${key}" \\
  -H "content-type: application/json" \\
  -d '{"ttlMinutes": 1440, "webhookUrl": "https://your-app.example.com/hooks/email"}'`
    : `curl -X POST https://receivemail.dev/mailboxes \\
  -H "Authorization: Bearer ${key}" \\
  -H "content-type: application/json" \\
  -d '{"ttlMinutes": 1440}'`;

  return htmlPage(
    "Your API key",
    `<h1>You're in 🎉</h1>
<p>receivemail.dev <strong>${webhooks ? "Pro + Webhooks" : "Pro"}</strong> is active. Your API key:</p>
<p><code class="key">${key}</code></p>
<p><strong>Copy it now</strong> — this page stops showing it 24 hours after purchase.</p>
<h2>Use it</h2>
<p>Send it as a Bearer token when creating a mailbox. Paid mailboxes live up to 24h (free: 60 min), skip the free tier's per-IP limits (${PAID_CREATES_PER_MINUTE} creates/min per key), and every message comes back with the verification code already extracted in an <code>otp</code> field.</p>
<pre>${createExample}</pre>
${
  webhooks
    ? `<p>Every email that lands in that mailbox is POSTed to your <code>webhookUrl</code> as JSON: <code>{address, from, subject, bodyText, otp, receivedAt}</code>. Verify it's from us: <code>X-Receivemail-Signature</code> is the hex HMAC-SHA256 of the raw request body, keyed with your API key.</p>`
    : `<p>Want each email pushed to your own URL instead of polling? That's the Pro + Webhooks plan on <a href="/#pro">the pricing section</a>.</p>`
}
<p>To cancel any time, email flovoice53@gmail.com — the key stops working when the subscription ends.</p>`,
  );
}

export default {
  // Incoming mail always gets stored regardless of whether a `mailboxes` row
  // exists for it — same "any address just works" behavior every disposable
  // inbox provider has. The mailboxes table only exists to let API clients
  // reserve a fresh random address with a known expiry, it's not a gate on
  // what mail gets accepted.
  async email(
    message: ForwardableEmailMessage,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(raw);
    const mailbox = message.to.toLowerCase();
    const subject = parsed.subject ?? null;
    const bodyText = parsed.text ?? null;

    await env.DB.prepare(
      `INSERT INTO emails (mailbox, from_address, subject, body_text) VALUES (?, ?, ?, ?)`,
    )
      .bind(mailbox, message.from, subject, bodyText)
      .run();

    // Webhooks tier: push the message to the owner's URL. Re-checks the key
    // is still active and still on the webhooks tier at delivery time, so a
    // cancelled subscription stops deliveries on mailboxes it already made.
    const target = await env.DB.prepare(
      `SELECT m.webhook_url, k.stripe_session_id FROM mailboxes m
       JOIN api_keys k ON k.key_hash = m.owner_key_hash
       WHERE m.address = ? AND m.webhook_url IS NOT NULL AND k.status = 'active' AND k.tier = 'webhooks'`,
    )
      .bind(mailbox)
      .first<{ webhook_url: string; stripe_session_id: string }>();
    if (target) {
      ctx.waitUntil(
        deliverWebhook(env, target.webhook_url, target.stripe_session_id, {
          address: mailbox,
          // Header From (who the customer recognizes), not the envelope
          // sender — that's often a bounce address like 0102…@send.example.com.
          from: parsed.from?.address || message.from,
          subject,
          bodyText,
          otp: extractOtp(subject, bodyText),
          receivedAt: new Date().toISOString(),
        }),
      );
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (request.method === "GET" && parts.length === 0) {
      return new Response(LANDING_HTML, {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // IndexNow ownership key (same key on every host, see public/80c5e6c528195e6dc886ed6fc86c04b4.txt in sms-florin).
    if (request.method === "GET" && parts.length === 1 && parts[0] === "80c5e6c528195e6dc886ed6fc86c04b4.txt") {
      return new Response("80c5e6c528195e6dc886ed6fc86c04b4", { headers: { "content-type": "text/plain;charset=utf-8" } });
    }

    if (request.method === "GET" && parts.length === 1 && parts[0] === "robots.txt") {
      return new Response(
        "User-agent: *\nAllow: /\nDisallow: /mailboxes\nSitemap: https://receivemail.dev/sitemap.xml\n",
        { headers: { "content-type": "text/plain;charset=utf-8" } },
      );
    }

    // Same idea as sms-florin's and otp-watch's own /llms.txt: a plain-text
    // summary for an LLM or agent asking "what does this do and how do I use
    // it", rather than one that has to scrape the HTML landing page.
    if (request.method === "GET" && parts.length === 1 && parts[0] === "llms.txt") {
      return new Response(
        `# receivemail.dev

> A real inbox for your test suite. POST to create a disposable email address, no signup, then poll it for whatever lands there.

Built for the same audience as sms-florin (QA/dev, AI agents testing signup flows) — a throwaway inbox instead of a throwaway phone number.

## How it works

- \`POST /mailboxes\` — creates a random address (default 15min TTL, max 60min) and returns \`{address, expiresAt, secret}\`. No token required to create one.
- \`GET /mailboxes/:address/messages\` — returns the last 50 messages for that address (\`from_address\`, \`subject\`, \`body_text\`, \`received_at\` in ISO 8601 UTC), authenticated with \`Authorization: Bearer <secret>\` using the mailbox's own \`secret\` from creation. Only reserved addresses can be read. Plain-text body only (no HTML, no attachments); mail is kept about 24h.
- Free, no signup, no API key. FAQ (Playwright/Cypress recipes, limits, retention): https://receivemail.dev/faq
- Rate limited: 20 creates/min/IP, 5,000 creates/day globally.

## Paid plans (optional)

- Pro, $7/mo: send \`Authorization: Bearer rmk_...\` on \`POST /mailboxes\` — mailboxes up to 24h (\`ttlMinutes\` up to 1440), 120 creates/min per key instead of the per-IP limit, and each message from \`GET /mailboxes/:address/messages\` includes an extracted \`otp\` field.
- Pro + Webhooks, $19/mo: everything in Pro, plus pass \`webhookUrl\` (public https) when creating a mailbox and every incoming email is POSTed there as JSON \`{address, from, subject, bodyText, otp, receivedAt}\`, signed with \`X-Receivemail-Signature\` = hex HMAC-SHA256(your API key, raw body).
- Subscribe on https://receivemail.dev/#pro — the API key is shown right after checkout.

## Docs

- [Landing page / quickstart](https://receivemail.dev/): curl examples, full endpoint reference.
- [Testing email verification flows in CI](https://receivemail.dev/guides/testing-verification-emails)
- [Getting verification codes without regex or polling (otp field, webhooks)](https://receivemail.dev/guides/email-otp-webhook)

## Related

- [sms-florin](https://flo-voice1.com/llms.txt): the phone-number rental service this shares its audience with — same "receive something, expose via API" pattern for SMS instead of email.
- [otp-watch](https://otpwatch.flo-voice1.com/llms.txt): synthetic monitoring built on top of both this and sms-florin, confirming an OTP/verification code actually arrives.
- [mcp-ssrf-scan](https://mcpscan.flo-voice1.com): static SSRF/secrets scanner for MCP servers, with optional CI scan history.
`,
        { headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

    if (request.method === "GET" && parts.length === 1 && parts[0] === "icon.svg") {
      return new Response(ICON_SVG, {
        headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" },
      });
    }

    if (request.method === "GET" && parts.length === 1 && parts[0] === "icon.png") {
      const bytes = Uint8Array.from(atob(ICON_PNG_BASE64), (ch) => ch.charCodeAt(0));
      return new Response(bytes, {
        headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
      });
    }

    if (request.method === "GET" && parts.length === 1 && parts[0] === "faq") {
      return new Response(FAQ_HTML, {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // Stripe webhook for the paid tiers — issues API keys automatically.
    if (request.method === "POST" && parts.length === 2 && parts[0] === "webhooks" && parts[1] === "stripe") {
      return handleStripeWebhook(request, env);
    }

    // Stripe Payment Link redirect target (both paid tiers). Stripe appends
    // ?session_id=cs_... — the key is re-derived from it and shown here. The
    // webhook can land a few seconds after the redirect, so until the row
    // exists the page refreshes itself. Shown for 24h after purchase; after
    // that a stale/leaked URL stops revealing the key.
    if (request.method === "GET" && parts.length === 2 && parts[0] === "pro" && parts[1] === "thanks") {
      return proThanksPage(env, url.searchParams.get("session_id"));
    }

    if (request.method === "GET" && parts.length === 1 && parts[0] === "sitemap.xml") {
      const urls = [
        "https://receivemail.dev/",
        "https://receivemail.dev/faq",
        ...GUIDE_SLUGS.map((s) => `https://receivemail.dev/guides/${s}`),
        ...COMPARE_SLUGS.map((s) => `https://receivemail.dev/compare/${s}`),
      ];
      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map((u) => `<url><loc>${u}</loc></url>`).join("\n") +
        `\n</urlset>\n`;
      return new Response(xml, {
        headers: { "content-type": "application/xml;charset=utf-8" },
      });
    }

    if (
      request.method === "GET" &&
      parts.length === 2 &&
      parts[0] === "guides" &&
      Object.prototype.hasOwnProperty.call(GUIDES, parts[1])
    ) {
      return new Response(GUIDES[parts[1]], {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    if (
      request.method === "GET" &&
      parts.length === 2 &&
      parts[0] === "compare" &&
      Object.prototype.hasOwnProperty.call(COMPARE, parts[1])
    ) {
      return new Response(COMPARE[parts[1]], {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    }

    // POST /pro-interest — the landing page's "Need more?" form. A demand
    // test for a paid tier, nothing is sold here. Capped per IP so the form
    // can't be used to fill the table.
    if (request.method === "POST" && parts.length === 1 && parts[0] === "pro-interest") {
      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      if (!(await checkHourlyIpLimit(env, `pro:ip:${ip}`, PRO_INTEREST_PER_IP_PER_HOUR))) {
        return tooManyRequests();
      }

      let body: { email?: unknown; features?: unknown; note?: unknown };
      try {
        body = await request.json();
      } catch {
        return jsonError("invalid JSON", 400);
      }
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!EMAIL_SHAPE.test(email) || email.length > 254) return jsonError("please enter a valid email", 400);
      const features = Array.isArray(body.features)
        ? body.features.filter((f): f is string => typeof f === "string" && PRO_FEATURES.includes(f))
        : [];
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

      await env.DB.prepare(
        `INSERT INTO pro_interest (email, features, note) VALUES (?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET features = excluded.features, note = excluded.note,
           updated_at = datetime('now')`,
      )
        .bind(email, JSON.stringify(features), note)
        .run();

      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }

    // POST /mailboxes — reserve a fresh random address. Public/self-serve —
    // no token required to create one, same as any other disposable-inbox
    // provider. Protected by two independent caps instead: per-IP (stops one
    // abusive caller) and a daily global ceiling (stops many distinct IPs at
    // once). The admin API_TOKEN still works for reading any mailbox (see
    // canReadMailbox), it's just no longer required to create one.
    if (request.method === "POST" && parts[0] === "mailboxes" && parts.length === 1) {
      // Optional paid key. A key that's presented but invalid/cancelled is a
      // 401, not a silent downgrade to the free tier — the caller would
      // otherwise get 60-minute mailboxes and no webhooks without noticing.
      const authHeader = request.headers.get("authorization") ?? "";
      const presentedKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      const paidKey = presentedKey ? await lookupActiveKey(env, presentedKey) : null;
      if (presentedKey && !paidKey) return jsonError("invalid or inactive API key", 401);

      if (paidKey) {
        if (!(await checkKeyCreateLimit(env, paidKey.key_hash))) return tooManyRequests();
      } else {
        if (!(await checkDailyGlobalLimit(env))) return tooManyRequests();
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (!(await checkCreateRateLimit(env, ip))) return tooManyRequests();
      }

      const maxTtl = paidKey ? PAID_MAX_TTL_MINUTES : MAX_TTL_MINUTES;
      let ttlMinutes = DEFAULT_TTL_MINUTES;
      let webhookUrl: string | null = null;
      try {
        const body = (await request.json()) as { ttlMinutes?: unknown; webhookUrl?: unknown };
        if (typeof body?.ttlMinutes === "number" && Number.isFinite(body.ttlMinutes)) {
          ttlMinutes = Math.min(Math.max(1, body.ttlMinutes), maxTtl);
        }
        if (body?.webhookUrl !== undefined && body.webhookUrl !== null) {
          if (paidKey?.tier !== "webhooks") {
            return jsonError("webhookUrl needs the Pro + Webhooks plan — see https://receivemail.dev/#pro", 402);
          }
          webhookUrl = validateWebhookUrl(body.webhookUrl);
          if (!webhookUrl) return jsonError("webhookUrl must be a public https URL", 400);
        }
      } catch {
        // No/invalid body — use the default TTL.
      }

      const address = randomAddress();
      const secret = randomSecret();
      const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
      // Stored only for the daily bot/VPN-traffic classification in
      // recordDailyStats — not exposed via any API response.
      const creatorIp = request.headers.get("cf-connecting-ip") ?? null;

      await env.DB.prepare(
        `INSERT INTO mailboxes (address, expires_at, secret, owner_key_hash, webhook_url, creator_ip) VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(address, expiresAt, secret, paidKey?.key_hash ?? null, webhookUrl, creatorIp)
        .run();

      // secret is only ever returned here, at creation — the caller must
      // hold onto it to read this mailbox's messages later. `tip` is an extra
      // field existing clients ignore; the ref tags clicks from the API apart
      // from clicks on the landing page in sms-florin's attribution.
      if (paidKey) {
        return Response.json({ address, expiresAt, secret, tier: paidKey.tier, webhookUrl }, { status: 201 });
      }
      return Response.json(
        {
          address,
          expiresAt,
          secret,
          tip: "Need the SMS verification code too? Real UK numbers: https://flo-voice1.com/?ref=receivemail-api",
          // Same "extra field, ignored by existing clients" pattern as `tip`.
          // Only anonymous callers see it — paid responses return early above.
          upgrade:
            "Want the verification code extracted for you (no regex), 24h mailboxes, or each email pushed to your webhook? https://receivemail.dev/guides/email-otp-webhook",
        },
        { status: 201 },
      );
    }

    // GET /mailboxes/:address — mailbox metadata (exists? expired?).
    if (
      request.method === "GET" &&
      parts[0] === "mailboxes" &&
      parts.length === 2
    ) {
      const address = decodeURIComponent(parts[1]).toLowerCase();
      if (!(await canReadMailbox(env, request, address))) return unauthorized();

      const mailbox = await env.DB.prepare(
        `SELECT address, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) AS created_at, expires_at FROM mailboxes WHERE address = ?`,
      )
        .bind(address)
        .first();

      if (!mailbox) return notFound();
      return Response.json(mailbox);
    }

    // GET /mailboxes/:address/messages — messages received for an address.
    // Works even for addresses never explicitly reserved via POST /mailboxes,
    // matching the always-accept behavior of the email() handler above — but
    // an unreserved address has no secret on file, so only the admin token
    // can read it (a real client always goes through POST /mailboxes first).
    if (
      request.method === "GET" &&
      parts[0] === "mailboxes" &&
      parts.length === 3 &&
      parts[2] === "messages"
    ) {
      const address = decodeURIComponent(parts[1]).toLowerCase();
      if (!(await canReadMailbox(env, request, address))) return unauthorized();

      const { results } = await env.DB.prepare(
        // received_at is stored as a zone-less UTC SQLite datetime; hand it out
        // as ISO 8601 with a Z, since JS parses a zone-less timestamp as
        // local time (that broke the Playwright/Cypress plugins' "only new
        // mail" filter for anyone east of UTC, until 2026-09-26).
        `SELECT from_address, subject, body_text, strftime('%Y-%m-%dT%H:%M:%SZ', received_at) AS received_at FROM emails WHERE mailbox = ? ORDER BY emails.received_at DESC LIMIT 50`,
      )
        .bind(address)
        .all<{ from_address: string; subject: string | null; body_text: string | null; received_at: string }>();

      // Paid mailboxes get the verification code pre-extracted per message.
      const owner = await env.DB.prepare(`SELECT owner_key_hash FROM mailboxes WHERE address = ?`)
        .bind(address)
        .first<{ owner_key_hash: string | null }>();
      if (owner?.owner_key_hash) {
        return Response.json({
          address,
          messages: results.map((m) => ({ ...m, otp: extractOtp(m.subject, m.body_text) })),
        });
      }
      return Response.json({ address, messages: results });
    }

    return notFound();
  },

  // Runs on the cron schedule set in wrangler.toml — sweeps expired
  // mailboxes and prunes old mail so D1 doesn't grow unbounded. Messages
  // outlive their mailbox's TTL by 24h (so a client polling right at
  // expiry can still read the last message) before being deleted.
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    // Before any pruning below. A failure here must not stop the cleanup.
    const yesterday = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
    try {
      await recordDailyStats(env, yesterday);
    } catch (err) {
      console.error("recordDailyStats failed", err);
    }

    const now = new Date().toISOString();
    await env.DB.prepare(`DELETE FROM mailboxes WHERE expires_at < ?`)
      .bind(now)
      .run();

    // Compared as SQLite datetimes: the column holds "YYYY-MM-DD HH:MM:SS"
    // and a raw string comparison against an ISO cutoff ("...T...") deleted
    // same-day mail early.
    const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    await env.DB.prepare(`DELETE FROM emails WHERE datetime(received_at) < datetime(?)`)
      .bind(cutoff)
      .run();

    // Per-IP windows are at most an hour (60s for creates, 1h for the Pro
    // interest form) — anything older than that is stale.
    const ipRateLimitCutoff = Date.now() - 60 * 60_000;
    await env.DB.prepare(
      `DELETE FROM rate_limits
       WHERE (bucket_key LIKE 'create:ip:%' OR bucket_key LIKE 'create:key:%' OR bucket_key LIKE 'pro:ip:%')
         AND window_start < ?`,
    )
      .bind(ipRateLimitCutoff)
      .run();

    // Daily buckets need to survive a full day — clear anything older than
    // 2 days as a safety margin, not 1 hour like the per-IP ones above.
    const dailyRateLimitCutoff = Date.now() - 2 * 24 * 60 * 60_000;
    await env.DB.prepare(
      `DELETE FROM rate_limits WHERE bucket_key LIKE 'create:daily:%' AND window_start < ?`,
    )
      .bind(dailyRateLimitCutoff)
      .run();
  },
};
