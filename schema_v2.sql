CREATE TABLE IF NOT EXISTS mailboxes (
  address TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
