// Machine-readable files for AI agents and crawlers: OpenAPI contract, AI
// Catalog, pricing page, homepage JSON-LD and a Markdown twin of the landing
// page. Added 2026-11-02 after an agent-readiness scan (getdedica.com, which
// follows the AgentReady spec) scored the site 46/100, mostly for missing
// these. Keep the numbers here in step with index.ts / billing.ts.

const BASE = "https://receivemail.dev";
const PRO_LINK = "https://buy.stripe.com/dRm7sL0my8QRgMMf6GcZa00";
const WEBHOOKS_LINK = "https://buy.stripe.com/fZufZh4CO7MNdAAgaKcZa01";
const CONTACT = "flovoice53@gmail.com";
// Bump when any page listed in the sitemap changes meaningfully.
export const SITE_UPDATED = "2026-11-02";

const SAME_AS = [
  "https://github.com/flovoice53-tech/receivemail-worker",
  "https://www.npmjs.com/package/playwright-receivemail",
  "https://www.npmjs.com/package/cypress-receivemail",
  "https://www.npmjs.com/package/n8n-nodes-receivemail",
  "https://devhunt.org/tool/receivemaildev",
  "https://x.com/florin_builds",
];

const OFFERS = [
  { name: "Free", price: "0", description: "No signup or API key. Mailboxes up to 60 minutes, 20 creates/min per IP, 5,000 creates/day shared.", url: `${BASE}/pricing` },
  { name: "Pro", price: "7", description: "API key. Mailboxes up to 24 hours, 120 creates/min per key, verification code extracted in an otp field.", url: PRO_LINK },
  { name: "Pro + Webhooks", price: "19", description: "Everything in Pro, plus every incoming email POSTed to your HTTPS webhook, HMAC-signed.", url: WEBHOOKS_LINK },
];

const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${BASE}/#organization`,
  name: "receivemail.dev",
  url: `${BASE}/`,
  logo: `${BASE}/icon.png`,
  email: CONTACT,
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: CONTACT },
  sameAs: SAME_AS,
};

function offerLd(o: (typeof OFFERS)[number]) {
  return {
    "@type": "Offer",
    name: o.name,
    price: o.price,
    priceCurrency: "USD",
    description: o.description,
    url: o.url,
    ...(o.price === "0"
      ? {}
      : { priceSpecification: { "@type": "UnitPriceSpecification", price: o.price, priceCurrency: "USD", billingDuration: "P1M", unitText: "month" } }),
  };
}

export const HOME_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    ORGANIZATION,
    {
      "@type": "WebSite",
      "@id": `${BASE}/#website`,
      name: "receivemail.dev",
      url: `${BASE}/`,
      publisher: { "@id": `${BASE}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${BASE}/#app`,
      name: "receivemail.dev",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any (HTTP API)",
      url: `${BASE}/`,
      description:
        "Disposable email addresses via API for testing signup and verification-email flows. Create a mailbox with one POST, no signup, then read or long-poll the messages it receives.",
      publisher: { "@id": `${BASE}/#organization` },
      offers: OFFERS.map(offerLd),
    },
  ],
});

// Head tags shared by the landing page: JSON-LD plus links agents follow
// (86–100% of discovery-file visits arrive through a link, per AgentReady).
export const AGENT_HEAD_LINKS = `<link rel="ai-catalog" href="/.well-known/ai-catalog.json">
<link rel="service-desc" type="application/openapi+json" href="/openapi.json">
<link rel="alternate" type="text/markdown" href="/index.md">
<link rel="alternate" type="text/plain" href="/llms.txt">
<script type="application/ld+json">${HOME_JSON_LD}</script>`;

export const HOME_LINK_HEADER =
  '</.well-known/ai-catalog.json>; rel="ai-catalog", </openapi.json>; rel="service-desc"; type="application/openapi+json", </index.md>; rel="alternate"; type="text/markdown"';

const errorSchema = { $ref: "#/components/schemas/Error" };
const secretAuth = [{ mailboxSecret: [] }];
const addressParam = {
  name: "address",
  in: "path",
  required: true,
  description: "The full address returned by POST /mailboxes, e.g. a1b2c3d4e5f6@receivemail.dev (URL-encode the @ if your client needs it).",
  schema: { type: "string" },
};
const errors = (codes: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(codes).map(([code, description]) => [code, { description, content: { "application/json": { schema: errorSchema } } }]),
  );

export const OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "receivemail.dev API",
    version: "1.0.0",
    summary: "Disposable email inboxes for tests, one API call, no signup.",
    description:
      "Create a throwaway email address, trigger your app's verification email to it, then read or long-poll what arrives. Free without an API key; paid plans (Pro $7/mo, Pro + Webhooks $19/mo) add 24h mailboxes, higher limits, an extracted `otp` field and signed webhooks. Plain-text bodies only (no HTML or attachments); mail is kept about 24h. Rate limits: free 20 creates/min per IP and 5,000/day shared; paid 120 creates/min per key.",
    contact: { name: "receivemail.dev", email: CONTACT, url: `${BASE}/` },
    termsOfService: `${BASE}/faq`,
  },
  servers: [{ url: BASE }],
  externalDocs: { description: "Quickstart, FAQ and guides", url: `${BASE}/faq` },
  tags: [{ name: "mailboxes", description: "Create disposable mailboxes and read their messages." }],
  paths: {
    "/mailboxes": {
      post: {
        operationId: "createMailbox",
        tags: ["mailboxes"],
        summary: "Create a disposable mailbox",
        description:
          "Returns a random address and its secret. No authentication needed on the free tier. Send `Authorization: Bearer rmk_…` (a paid API key) for 24h mailboxes, per-key limits and webhooks. The secret is returned only here; keep it to read the mailbox.",
        security: [{}, { apiKey: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ttlMinutes: { type: "integer", minimum: 1, maximum: 1440, default: 15, description: "Mailbox lifetime. Free tier is capped at 60, paid keys at 1440." },
                  webhookUrl: { type: "string", format: "uri", description: "Pro + Webhooks only: public https URL that receives each email as signed JSON." },
                },
              },
              example: { ttlMinutes: 15 },
            },
          },
        },
        responses: {
          "201": {
            description: "Mailbox created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Mailbox" },
                example: { address: "a1b2c3d4e5f6@receivemail.dev", expiresAt: "2026-11-02T10:15:00.000Z", secret: "3f9c…" },
              },
            },
          },
          ...errors({
            "400": "Invalid webhookUrl",
            "401": "API key presented but invalid or inactive",
            "402": "webhookUrl needs the Pro + Webhooks plan",
            "429": "Rate limited (free: 20/min per IP or the shared daily limit; paid: 120/min per key)",
          }),
        },
      },
    },
    "/mailboxes/{address}": {
      get: {
        operationId: "getMailbox",
        tags: ["mailboxes"],
        summary: "Get mailbox metadata",
        security: secretAuth,
        parameters: [addressParam],
        responses: {
          "200": {
            description: "Mailbox metadata",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { address: { type: "string" }, created_at: { type: "string", format: "date-time" }, expires_at: { type: "string", format: "date-time" } },
                },
              },
            },
          },
          ...errors({ "401": "Missing or wrong mailbox secret", "404": "Mailbox not found" }),
        },
      },
    },
    "/mailboxes/{address}/messages": {
      get: {
        operationId: "listMessages",
        tags: ["mailboxes"],
        summary: "List messages received by a mailbox",
        description: "Last 50 messages, newest first. Paid mailboxes include an `otp` field per message.",
        security: secretAuth,
        parameters: [addressParam],
        responses: {
          "200": {
            description: "Messages",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["address", "messages"],
                  properties: {
                    address: { type: "string" },
                    messages: { type: "array", items: { $ref: "#/components/schemas/Message" } },
                    upgrade: { type: "string", description: "Free tier only: present when a message contains a verification code." },
                  },
                },
              },
            },
          },
          ...errors({ "401": "Missing or wrong mailbox secret" }),
        },
      },
    },
    "/mailboxes/{address}/wait": {
      get: {
        operationId: "waitForMessage",
        tags: ["mailboxes"],
        summary: "Long-poll for the next message",
        description: "Holds the request until a message newer than `since` arrives, then returns it; after `timeout` seconds returns `timed_out: true`. Call again on timeout.",
        security: secretAuth,
        parameters: [
          addressParam,
          { name: "timeout", in: "query", required: false, description: "Seconds to wait, 1–25.", schema: { type: "integer", minimum: 1, maximum: 25, default: 25 } },
          { name: "since", in: "query", required: false, description: "ISO 8601 timestamp; only messages received after it count.", schema: { type: "string", format: "date-time" } },
        ],
        responses: {
          "200": {
            description: "A message, or a timeout",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["address", "timed_out"],
                  properties: {
                    address: { type: "string" },
                    timed_out: { type: "boolean" },
                    message: { oneOf: [{ $ref: "#/components/schemas/Message" }, { type: "null" }] },
                    upgrade: { type: "string" },
                  },
                },
              },
            },
          },
          ...errors({ "400": "since is not an ISO 8601 timestamp", "401": "Missing or wrong mailbox secret" }),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      mailboxSecret: { type: "http", scheme: "bearer", description: "The mailbox's own `secret` from POST /mailboxes." },
      apiKey: { type: "http", scheme: "bearer", description: "Paid API key (rmk_…), shown right after checkout at https://receivemail.dev/pricing." },
    },
    schemas: {
      Mailbox: {
        type: "object",
        required: ["address", "expiresAt", "secret"],
        properties: {
          address: { type: "string", example: "a1b2c3d4e5f6@receivemail.dev" },
          expiresAt: { type: "string", format: "date-time" },
          secret: { type: "string", description: "Bearer token for reading this mailbox. Only returned here." },
          tier: { type: "string", enum: ["pro", "webhooks"], description: "Paid keys only." },
          webhookUrl: { type: ["string", "null"], description: "Paid keys only." },
          tip: { type: "string", description: "Free tier only: informational." },
          upgrade: { type: "string", description: "Free tier only: informational." },
        },
      },
      Message: {
        type: "object",
        required: ["from_address", "received_at"],
        properties: {
          from_address: { type: "string" },
          subject: { type: ["string", "null"] },
          body_text: { type: ["string", "null"], description: "Plain-text body. No HTML or attachments." },
          received_at: { type: "string", format: "date-time" },
          otp: { type: ["string", "null"], description: "Paid mailboxes only: the verification code found in the email." },
        },
      },
      Error: {
        type: "object",
        required: ["error"],
        properties: { error: { type: "string" }, upgrade: { type: "string" } },
      },
    },
  },
};

export const AI_CATALOG = {
  specVersion: "1.0",
  host: { name: "receivemail.dev", url: `${BASE}/`, contact: CONTACT },
  entries: [
    {
      identifier: "urn:receivemail.dev:openapi:api",
      displayName: "receivemail.dev API (OpenAPI)",
      mediaType: "application/openapi+json",
      type: "application/openapi+json",
      representativeQueries: [
        "Create a disposable email address for a signup test",
        "Wait for the verification email and read the code",
      ],
      url: `${BASE}/openapi.json`,
    },
    {
      identifier: "urn:receivemail.dev:llms:summary",
      displayName: "receivemail.dev llms.txt",
      mediaType: "text/plain",
      type: "text/plain",
      url: `${BASE}/llms.txt`,
    },
    {
      identifier: "urn:receivemail.dev:docs:home",
      displayName: "receivemail.dev quickstart (Markdown)",
      mediaType: "text/markdown",
      type: "text/markdown",
      url: `${BASE}/index.md`,
    },
    {
      identifier: "urn:receivemail.dev:docs:pricing",
      displayName: "receivemail.dev pricing",
      mediaType: "text/html",
      type: "text/html",
      url: `${BASE}/pricing`,
    },
  ],
};

export const WHEN_TO_USE = `## When to use receivemail.dev

- Use it when an automated test, script or AI agent needs a real email address that receives mail right now, without a signup or API key: signup flows, email verification codes, magic links, password resets.
- Use \`GET /mailboxes/{address}/wait\` instead of writing a polling loop.
- Don't use it for a permanent inbox, sending email, HTML bodies or attachments, or anything private: addresses expire (60 minutes free, 24 hours on Pro) and mail is kept about 24 hours.`;

export const LANDING_MD = `# receivemail.dev

> A real inbox, on demand. One API call, no signup. Disposable email addresses that actually receive mail, for verification-email testing, signup-flow QA and AI agents.

${WHEN_TO_USE}

## Quickstart

\`\`\`bash
# create a mailbox (default: expires in 15 min)
curl -X POST https://receivemail.dev/mailboxes
# => {"address":"a1b2c3d4e5f6@receivemail.dev","expiresAt":"...","secret":"..."}

# trigger your app's verification email to that address, then wait for it:
curl "https://receivemail.dev/mailboxes/a1b2c3d4e5f6@receivemail.dev/wait?timeout=25" \\
  -H "Authorization: Bearer <secret from above>"
\`\`\`

## Endpoints

| Endpoint | Description |
|---|---|
| \`POST /mailboxes\` | Create an address. Optional \`{"ttlMinutes": 1-60}\` (paid: up to 1440), default 15. Returns \`address\`, \`expiresAt\`, \`secret\`. |
| \`GET /mailboxes/{address}\` | Mailbox metadata. Bearer = the mailbox secret. |
| \`GET /mailboxes/{address}/messages\` | Last 50 messages, newest first. Same secret. |
| \`GET /mailboxes/{address}/wait\` | Long-poll up to \`timeout\` seconds (max 25) for a message newer than \`since\`. Same secret. |

Machine-readable contract: [openapi.json](https://receivemail.dev/openapi.json).

## Pricing

| Plan | Price | What you get |
|---|---|---|
| Free | $0 | No signup or key. Mailboxes up to 60 min, 20 creates/min per IP, 5,000 creates/day shared. |
| Pro | $7/month | API key. Mailboxes up to 24h, 120 creates/min per key, \`otp\` field with the extracted code. |
| Pro + Webhooks | $19/month | Everything in Pro, plus each email POSTed to your HTTPS webhook, HMAC-signed. |

Details: [pricing](https://receivemail.dev/pricing). The API key is shown right after checkout.

## Limits

- Plain-text bodies only (no HTML, no attachments).
- Messages are kept about 24 hours.
- Any address at @receivemail.dev accepts mail, but only a reserved address gives you a secret to read it.

## More

- [FAQ](https://receivemail.dev/faq): Playwright and Cypress recipes, limits, retention
- [Testing email verification flows in CI](https://receivemail.dev/guides/testing-verification-emails)
- [Verification codes without regex or polling](https://receivemail.dev/guides/email-otp-webhook)
- [llms.txt](https://receivemail.dev/llms.txt)
- Contact: ${CONTACT}
`;

export const PRICING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pricing — receivemail.dev</title>
<meta name="description" content="receivemail.dev is free with no signup. Pro ($7/month) adds 24h mailboxes, 120 creates/min and an extracted otp field; Pro + Webhooks ($19/month) pushes every email to your URL.">
<link rel="canonical" href="${BASE}/pricing">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="alternate" type="text/markdown" href="/index.md">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "receivemail.dev",
  description: "Disposable email addresses via API for testing signup and verification-email flows.",
  url: `${BASE}/pricing`,
  brand: { "@id": `${BASE}/#organization`, "@type": "Organization", name: "receivemail.dev" },
  offers: OFFERS.map(offerLd),
})}</script>
<style>
body{margin:0;background:#0b0d10;color:#e8eaed;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}
.wrap{max-width:760px;margin:0 auto;padding:3rem 1.5rem 5rem}a{color:#5eead4}
h1{font-size:1.8rem;margin:0 0 .5rem}p.lede{color:#9aa4af}
table{width:100%;border-collapse:collapse;margin:1.5rem 0;font-size:.95rem}th,td{text-align:left;padding:.6rem .5rem;border-bottom:1px solid #262b31;vertical-align:top}th{color:#9aa4af;font-weight:600}
code{font-family:ui-monospace,Menlo,monospace;background:#151a20;border-radius:6px;padding:.1rem .35rem}
.btn{display:inline-block;background:#5eead4;color:#0b0d10;border-radius:8px;padding:.6rem 1.1rem;font-weight:600;text-decoration:none;margin:.3rem .5rem .3rem 0}
@media(max-width:560px){th,td{padding:.5rem .3rem;font-size:.88rem}}
</style>
</head>
<body>
<div class="wrap">
<p><a href="/">← receivemail.dev</a></p>
<h1>Pricing</h1>
<p class="lede">The API is free with no signup or key. Paid plans are monthly, cancel any time, and the API key is shown on screen right after checkout.</p>
<table>
<thead><tr><th>Plan</th><th>Price</th><th>Mailbox lifetime</th><th>Create limit</th><th>Extras</th></tr></thead>
<tbody>
<tr><td>Free</td><td>$0</td><td>up to 60 min</td><td>20/min per IP, 5,000/day shared</td><td>Read with <code>/messages</code> or long-poll <code>/wait</code></td></tr>
<tr><td>Pro</td><td>$7/month</td><td>up to 24 hours</td><td>120/min per key</td><td>Verification code extracted in an <code>otp</code> field</td></tr>
<tr><td>Pro + Webhooks</td><td>$19/month</td><td>up to 24 hours</td><td>120/min per key</td><td>Everything in Pro, plus each email POSTed to your HTTPS URL, HMAC-signed</td></tr>
</tbody>
</table>
<p>All plans: plain-text bodies (no HTML or attachments), messages kept about 24 hours, same API (<a href="/openapi.json">OpenAPI</a>).</p>
<p><a class="btn" href="${PRO_LINK}">Subscribe to Pro — $7/mo</a><a class="btn" href="${WEBHOOKS_LINK}">Subscribe to Pro + Webhooks — $19/mo</a></p>
<p>Send the key as <code>Authorization: Bearer rmk_…</code> on <code>POST /mailboxes</code>. To cancel, email ${CONTACT}; the key stops working when the subscription ends.</p>
</div>
</body>
</html>`;
