-- Interest sign-ups for a possible paid tier, from the "Need more?" form on
-- the landing page. A demand test before building anything: if nobody leaves
-- an email here, there is no Pro plan to build. One row per email; a repeat
-- submission updates the features and keeps the first created_at.
CREATE TABLE IF NOT EXISTS pro_interest (
  email TEXT PRIMARY KEY,
  features TEXT NOT NULL,             -- JSON array of the boxes they ticked
  note TEXT,                          -- optional free text, capped at 500 chars
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
