-- Track the creating IP per mailbox (not for identity, just for the daily
-- hosting/proxy bot-traffic classification below) and two new daily_stats
-- columns that separate real-looking traffic from suspected automated/VPN
-- traffic. Found 2026-10-17: the daily mailboxes_created count had grown
-- from ~80/day to 400+/day, but Pro interest stayed at 0 and most of that
-- volume came from distinct IPs in known VPN/hosting ranges, each firing
-- once — classic bot-pool signature, not organic QA/dev growth.
ALTER TABLE mailboxes ADD COLUMN creator_ip TEXT;

ALTER TABLE daily_stats ADD COLUMN suspected_bot_mailboxes INTEGER;
ALTER TABLE daily_stats ADD COLUMN suspected_bot_external_emails INTEGER;
