-- One row per UTC day, written by the daily cron before it prunes mail and
-- rate-limit buckets — otherwise nothing older than ~2 days survives to
-- measure usage with. Counts and sender domains only, never addresses or
-- message content.
CREATE TABLE IF NOT EXISTS daily_stats (
  day TEXT PRIMARY KEY,               -- YYYY-MM-DD (UTC)
  mailboxes_created INTEGER NOT NULL, -- POST /mailboxes calls that succeeded
  emails_received INTEGER NOT NULL,   -- all incoming mail that day
  external_emails INTEGER NOT NULL,   -- minus our own test senders
  mailboxes_with_mail INTEGER NOT NULL, -- distinct mailboxes with external mail
  top_sender_domains TEXT NOT NULL,   -- JSON [[domain, count], ...], external only, top 15
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
