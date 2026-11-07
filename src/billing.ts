// Paid tiers: automatic API-key issuance from Stripe, key lookup, webhook
// delivery and OTP extraction. Kept out of index.ts so the free, anonymous
// path there stays readable.

export interface BillingEnv {
  DB: D1Database;
  // Signing secret of the Stripe webhook endpoint pointed at /webhooks/stripe.
  STRIPE_WEBHOOK_SECRET: string;
  // Random secret the raw API keys are derived from — see deriveApiKey.
  KEY_SECRET: string;
}

export type Tier = "pro" | "webhooks";

// Which Stripe Payment Link sells which tier. The same Stripe account also
// runs sms-florin and otp-watch checkouts, so every checkout.session.completed
// for the whole account lands here too — anything not from one of these two
// links is ignored.
export const PAYMENT_LINK_TIERS: Record<string, Tier> = {
  plink_1UQmqVEX894ikaKTykgLsEjB: "pro", // $7/mo — buy.stripe.com/dRm7sL0my8QRgMMf6GcZa00
  plink_1UR1zCEX894ikaKTsuVH9wgr: "webhooks", // $19/mo — buy.stripe.com/fZufZh4CO7MNdAAgaKcZa01
};

// Stripe-hosted customer portal login (customer enters their billing email,
// Stripe sends a magic link). Self-serve cancel without a Stripe secret key in
// the Worker. The portal is account-wide, so it serves every product's
// subscriptions on this Stripe account.
export const BILLING_PORTAL_URL = "https://billing.stripe.com/p/login/dRm7sL0my8QRgMMf6GcZa00";

export const PAID_MAX_TTL_MINUTES = 24 * 60;
export const PAID_CREATES_PER_MINUTE = 120;
const STRIPE_TOLERANCE_SECONDS = 300;
const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_WEBHOOK_URL_LENGTH = 2000;

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// The raw key is a pure function of the Checkout session id, so it never has
// to be stored: the webhook stores only its hash, and the success page (which
// Stripe redirects to with the same session id) re-derives it to show the
// buyer. Rotating KEY_SECRET would invalidate every issued key — don't.
export async function deriveApiKey(env: BillingEnv, sessionId: string): Promise<string> {
  return `rmk_${(await hmacHex(env.KEY_SECRET, `api-key:${sessionId}`)).slice(0, 40)}`;
}

export interface ApiKeyRow {
  key_hash: string;
  tier: Tier;
  status: string;
  stripe_session_id: string;
  created_at: string;
}

export async function lookupActiveKey(env: BillingEnv, rawKey: string): Promise<ApiKeyRow | null> {
  if (!rawKey.startsWith("rmk_")) return null;
  const row = await env.DB.prepare(
    `SELECT key_hash, tier, status, stripe_session_id, created_at FROM api_keys WHERE key_hash = ?`,
  )
    .bind(await sha256Hex(rawKey))
    .first<ApiKeyRow>();
  return row && row.status === "active" ? row : null;
}

// Stripe-Signature: t=<unix>,v1=<hex hmac of "t.body">[,v1=...]
async function verifyStripeSignature(secret: string, header: string, body: string): Promise<boolean> {
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > STRIPE_TOLERANCE_SECONDS) return false;
  const expected = await hmacHex(secret, `${timestamp}.${body}`);
  return signatures.some((sig) => timingSafeEqual(sig, expected));
}

interface StripeEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

export async function handleStripeWebhook(request: Request, env: BillingEnv): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  if (!env.STRIPE_WEBHOOK_SECRET || !(await verifyStripeSignature(env.STRIPE_WEBHOOK_SECRET, signature, body))) {
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 400 });
  }

  const event = JSON.parse(body) as StripeEvent;
  const obj = event.data.object;

  if (event.type === "checkout.session.completed") {
    const tier = PAYMENT_LINK_TIERS[String(obj.payment_link ?? "")];
    if (tier) {
      const sessionId = String(obj.id);
      const email = (obj.customer_details as { email?: string } | null)?.email ?? null;
      const subscriptionId = typeof obj.subscription === "string" ? obj.subscription : null;
      // OR IGNORE on the unique session id: Stripe retries deliveries.
      await env.DB.prepare(
        `INSERT OR IGNORE INTO api_keys (key_hash, tier, email, stripe_session_id, stripe_subscription_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(await sha256Hex(await deriveApiKey(env, sessionId)), tier, email, sessionId, subscriptionId)
        .run();
    }
  } else if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
    const live = event.type === "customer.subscription.updated" && ["active", "trialing"].includes(String(obj.status));
    await env.DB.prepare(`UPDATE api_keys SET status = ? WHERE stripe_subscription_id = ?`)
      .bind(live ? "active" : "canceled", String(obj.id))
      .run();
  }

  return Response.json({ received: true });
}

// Customer-supplied URL we'll POST every incoming email to. Workers can't
// reach our own private network, but there's no reason to accept anything
// but a public https hostname — no plain http, no credentials in the URL,
// no IP literals or localhost-style names.
export function validateWebhookUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > MAX_WEBHOOK_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost") {
    return null;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return null;
  return url.toString();
}

const KEYWORD_CODE =
  /(?:code|otp|pin|passcode|password|verification|verify|confirm(?:ation)?|token|one[- ]time|cod)\D{0,40}?\b(\d{4,8})\b/gi;
const SIX_DIGITS = /\b(\d{6})\b/g;
const FOUR_TO_EIGHT = /\b(\d{4,8})\b/g;

// "© 2026" in a footer is not a code.
const looksLikeYear = (n: string) => n.length === 4 && /^(19|20)\d\d$/.test(n);

// Best-effort: the code a verification email is about, or null. Prefers a
// number right after a "code"/"OTP"/"verify"-style word, then a lone 6-digit
// number, then a lone 4-8 digit one — years excluded throughout.
export function extractOtp(subject: string | null, body: string | null): string | null {
  const text = `${subject ?? ""}\n${body ?? ""}`;
  const keyword = [...text.matchAll(KEYWORD_CODE)].map((m) => m[1]).find((n) => !looksLikeYear(n));
  if (keyword) return keyword;

  const six = [...new Set([...text.matchAll(SIX_DIGITS)].map((m) => m[1]))];
  if (six.length === 1) return six[0];

  const any = [...new Set([...text.matchAll(FOUR_TO_EIGHT)].map((m) => m[1]))].filter((n) => !looksLikeYear(n));
  return any.length === 1 ? any[0] : null;
}

export interface WebhookPayload {
  address: string;
  from: string;
  subject: string | null;
  bodyText: string | null;
  otp: string | null;
  receivedAt: string;
}

// Signed with the customer's own API key (re-derived from the session id),
// so they can verify the request came from us:
//   hex(HMAC-SHA256(apiKey, rawBody)) === X-Receivemail-Signature
// Two attempts; failures are logged, not retried further.
export async function deliverWebhook(
  env: BillingEnv,
  url: string,
  sessionId: string,
  payload: WebhookPayload,
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = await hmacHex(await deriveApiKey(env, sessionId), body);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "receivemail.dev-webhooks/1",
          "x-receivemail-signature": signature,
        },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
      if (res.ok) return;
      console.error(`webhook ${url} attempt ${attempt}: HTTP ${res.status}`);
    } catch (err) {
      console.error(`webhook ${url} attempt ${attempt} failed`, err);
    }
  }
}
