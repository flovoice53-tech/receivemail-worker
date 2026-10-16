-- Paid API keys, issued automatically when a Stripe Checkout (Payment Link)
-- completes — replaces the manual "we'll email your access" fulfilment.
-- The raw key is never stored: it's derived as HMAC(KEY_SECRET, session id)
-- (see deriveApiKey in src/billing.ts), so only its SHA-256 lives here and
-- the success page can re-derive it for the buyer from the session id alone.
CREATE TABLE IF NOT EXISTS api_keys (
  key_hash TEXT PRIMARY KEY,               -- SHA-256 hex of the raw key
  tier TEXT NOT NULL,                      -- 'pro' | 'webhooks'
  email TEXT,                              -- buyer's email from Checkout, for support
  stripe_session_id TEXT NOT NULL UNIQUE,  -- idempotency: a redelivered webhook is a no-op
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'canceled'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_api_keys_subscription ON api_keys(stripe_subscription_id);

-- Set only for mailboxes created with a paid key. owner_key_hash is what
-- unlocks the paid features on read (OTP extraction) and on delivery
-- (webhook_url, webhooks tier only).
ALTER TABLE mailboxes ADD COLUMN owner_key_hash TEXT;
ALTER TABLE mailboxes ADD COLUMN webhook_url TEXT;
