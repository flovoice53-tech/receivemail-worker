import PostalMime from "postal-mime";
import { LANDING_HTML } from "./landing.js";
import { GUIDES, GUIDE_SLUGS } from "./guides.js";
import { COMPARE, COMPARE_SLUGS } from "./compare.js";
import { FAQ_HTML } from "./faq.js";
import { ICON_PNG_BASE64, ICON_SVG } from "./icon.js";

export interface Env {
  DB: D1Database;
  API_TOKEN: string;
}

const DOMAIN = "receivemail.dev";
const DEFAULT_TTL_MINUTES = 15;
const MAX_TTL_MINUTES = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CREATES = 20;
const DAILY_GLOBAL_MAX_CREATES = 5_000;
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

function tooManyRequests(): Response {
  return new Response(JSON.stringify({ error: "rate limited, try again shortly" }), {
    status: 429,
    headers: { "content-type": "application/json" },
  });
}

// Fixed-window counter in D1. Not perfectly atomic under heavy concurrent
// load from the same IP (read-then-write race, same class of accepted risk
// as the sms-florin free-rental per-IP guard) — fine for the current low
// traffic; revisit with a Durable Object only if this is ever actually
// abused at volume.
// Snapshot one UTC day into daily_stats. Must run before scheduled() prunes:
// the cron fires at 03:00 UTC, when all of yesterday's mail and its
// create:daily bucket still exist. INSERT OR REPLACE so a re-run is harmless.
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

  await env.DB.prepare(
    `INSERT OR REPLACE INTO daily_stats
       (day, mailboxes_created, emails_received, external_emails, mailboxes_with_mail, top_sender_domains)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      day,
      created?.count ?? 0,
      totals?.n ?? 0,
      external?.n ?? 0,
      external?.boxes ?? 0,
      JSON.stringify(senders.map((s) => [s.domain, s.n])),
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

export default {
  // Incoming mail always gets stored regardless of whether a `mailboxes` row
  // exists for it — same "any address just works" behavior every disposable
  // inbox provider has. The mailboxes table only exists to let API clients
  // reserve a fresh random address with a known expiry, it's not a gate on
  // what mail gets accepted.
  async email(
    message: ForwardableEmailMessage,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(raw);
    const mailbox = message.to.toLowerCase();

    await env.DB.prepare(
      `INSERT INTO emails (mailbox, from_address, subject, body_text) VALUES (?, ?, ?, ?)`,
    )
      .bind(mailbox, message.from, parsed.subject ?? null, parsed.text ?? null)
      .run();
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (request.method === "GET" && parts.length === 0) {
      return new Response(LANDING_HTML, {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
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

## Docs

- [Landing page / quickstart](https://receivemail.dev/): curl examples, full endpoint reference.
- [Testing email verification flows in CI](https://receivemail.dev/guides/testing-verification-emails)

## Related

- [sms-florin](https://flo-voice1.com/llms.txt): the phone-number rental service this shares its audience with — same "receive something, expose via API" pattern for SMS instead of email.
- [otp-watch](https://otpwatch.flo-voice1.com/llms.txt): synthetic monitoring built on top of both this and sms-florin, confirming an OTP/verification code actually arrives.
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

    // POST /mailboxes — reserve a fresh random address. Public/self-serve —
    // no token required to create one, same as any other disposable-inbox
    // provider. Protected by two independent caps instead: per-IP (stops one
    // abusive caller) and a daily global ceiling (stops many distinct IPs at
    // once). The admin API_TOKEN still works for reading any mailbox (see
    // canReadMailbox), it's just no longer required to create one.
    if (request.method === "POST" && parts[0] === "mailboxes" && parts.length === 1) {
      if (!(await checkDailyGlobalLimit(env))) return tooManyRequests();

      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      if (!(await checkCreateRateLimit(env, ip))) return tooManyRequests();

      let ttlMinutes = DEFAULT_TTL_MINUTES;
      try {
        const body = (await request.json()) as { ttlMinutes?: unknown };
        if (typeof body?.ttlMinutes === "number" && Number.isFinite(body.ttlMinutes)) {
          ttlMinutes = Math.min(Math.max(1, body.ttlMinutes), MAX_TTL_MINUTES);
        }
      } catch {
        // No/invalid body — use the default TTL.
      }

      const address = randomAddress();
      const secret = randomSecret();
      const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

      await env.DB.prepare(
        `INSERT INTO mailboxes (address, expires_at, secret) VALUES (?, ?, ?)`,
      )
        .bind(address, expiresAt, secret)
        .run();

      // secret is only ever returned here, at creation — the caller must
      // hold onto it to read this mailbox's messages later. `tip` is an extra
      // field existing clients ignore; the ref tags clicks from the API apart
      // from clicks on the landing page in sms-florin's attribution.
      return Response.json(
        {
          address,
          expiresAt,
          secret,
          tip: "Need the SMS verification code too? Real UK numbers: https://flo-voice1.com/?ref=receivemail-api",
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
        .all();

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

    // Per-IP windows are tiny (60s) — anything older than an hour is stale.
    const ipRateLimitCutoff = Date.now() - 60 * 60_000;
    await env.DB.prepare(
      `DELETE FROM rate_limits WHERE bucket_key LIKE 'create:ip:%' AND window_start < ?`,
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
