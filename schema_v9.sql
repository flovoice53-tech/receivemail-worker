-- Daily funnel counters: how many people reach the landing page, the pricing
-- page, a Stripe checkout and the post-checkout page, split by where they came
-- from. Counts only — no IPs, no user agents. Added 2026-11-07 because the
-- 2026-11-06 Product Hunt launch could not be traced to a single visit.
CREATE TABLE IF NOT EXISTS funnel_daily (
  day TEXT NOT NULL,
  event TEXT NOT NULL,   -- view_landing | view_pricing | go_pro | go_webhooks | thanks
  source TEXT NOT NULL,  -- producthunt | npm | github | gitlab | mcp | search | other | direct | ref:<name>
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, source)
);
