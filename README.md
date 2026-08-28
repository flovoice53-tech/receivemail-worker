# receivemail.dev

A disposable, real-receiving email address via one API call. No signup, no SMTP setup, no account. Built for testing verification/OTP emails, signup flows, and anywhere a QA suite would otherwise need to burn a real inbox.

Live at [receivemail.dev](https://receivemail.dev).

## How it works

```bash
# create a mailbox (default: expires in 15 min)
curl -X POST https://receivemail.dev/mailboxes
# => {"address":"a1b2c3d4e5f6@receivemail.dev","expiresAt":"...","secret":"..."}

# trigger your own app's email to that address, then poll:
curl https://receivemail.dev/mailboxes/a1b2c3d4e5f6@receivemail.dev/messages \
  -H "Authorization: Bearer <secret from above>"
# => {"address":"...","messages":[{"from_address":"...","subject":"...","body_text":"..."}]}
```

The `secret` returned at creation is the only credential — hold onto it, there's no account/login. Any address at `@receivemail.dev` accepts mail even if never explicitly reserved (same as any disposable-inbox provider), but only a reserved address has a secret to read it back with.

## Endpoints

| Endpoint | Description |
| --- | --- |
| `POST /mailboxes` | Create a new address. Optional `{"ttlMinutes": 1-60}` body, default 15. Public, no token required. |
| `GET /mailboxes/:address` | Metadata (created/expiry). Requires the mailbox's own `secret` as a Bearer token. |
| `GET /mailboxes/:address/messages` | Last 50 messages, newest first. Same secret. |

## Limits

- 20 mailbox creations/minute per IP, 5,000/day globally.
- 60 minutes max mailbox lifetime — this is for short-lived test flows, not a permanent inbox.
- Messages are pruned 24h after their mailbox expires.

Free to use, no API key needed to create a mailbox.

## Architecture

Fully serverless, no shared infrastructure with anything else:

- **Cloudflare Email Routing** on the `receivemail.dev` zone receives the actual mail.
- **Cloudflare Worker** (`src/index.ts`) — an `email()` handler parses and stores incoming mail via [`postal-mime`](https://www.npmjs.com/package/postal-mime); a `fetch()` handler serves the REST API and the landing page (`src/landing.ts`); a `scheduled()` handler runs a daily cleanup of expired mailboxes/old mail/rate-limit buckets.
- **D1** (`schema.sql`, `schema_v2.sql`, `schema_v3.sql`) — `emails`, `mailboxes` (with a per-mailbox `secret` for capability-style read access), `rate_limits`.

## Local development

```bash
npm install
npx wrangler dev      # local dev server
npm run deploy        # wrangler deploy
```

Requires a Cloudflare account with the `receivemail.dev` zone, Email Routing configured, and a D1 database bound as `DB` in `wrangler.toml`.

## Related

[sms-florin](https://flo-voice1.com) — same idea, for SMS/OTP verification codes instead of email (rents a real UK phone number).
