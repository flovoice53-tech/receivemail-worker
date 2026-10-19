-- Split Reddit verification codes out of the daily external-mail count.
-- Found 2026-10-19: ~91% of external mail over 3 days (141 of 155) was
-- "<code> is your Reddit verification code", one mail per mailbox, no
-- mailbox tied to an API key — an account-creation pool, not QA/dev
-- adoption. `external_emails - reddit_code_emails` is the closest number to
-- real usage that the table can show.
ALTER TABLE daily_stats ADD COLUMN reddit_code_emails INTEGER;
