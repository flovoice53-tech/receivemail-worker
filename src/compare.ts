// Static comparison / "alternative to X" pages served from GET /compare/:slug.
// Same self-contained dark styling as the landing and guide pages. These target
// searches like "MailSlurp alternative" — the searcher is already shopping.
// Comparisons are kept factual and fair; competitors are described by their
// documented scope, not disparaged.

const SHARED_STYLE = `
  :root {
    --bg: #0b0d10; --bg-raised: #14171b; --border: #262b31;
    --text: #e8eaed; --text-dim: #9aa4af; --accent: #5eead4;
    --mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--sans); line-height: 1.65; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 3.5rem 1.5rem 6rem; }
  .logo { font-family: var(--mono); font-size: 0.9rem; }
  .logo a { color: var(--accent); text-decoration: none; }
  h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); line-height: 1.2; margin: 1.2rem 0 0.5rem; text-wrap: balance; }
  .meta { color: var(--text-dim); font-size: 0.95rem; margin-bottom: 2.5rem; }
  h2 { font-size: 1.15rem; margin: 2.5rem 0 0.8rem; }
  h3 { font-size: 1rem; margin: 1.6rem 0 0.4rem; }
  p { margin: 0 0 1rem; }
  ul, ol { color: var(--text-dim); padding-left: 1.3rem; }
  li { margin-bottom: 0.45rem; }
  a { color: var(--accent); }
  pre { background: var(--bg-raised); border: 1px solid var(--border); border-radius: 10px; padding: 1.1rem 1.3rem; overflow-x: auto; font-family: var(--mono); font-size: 0.83rem; color: #d1e8e2; }
  code { font-family: var(--mono); font-size: 0.85rem; }
  p code, li code, td code { background: var(--bg-raised); border: 1px solid var(--border); border-radius: 4px; padding: 0.1em 0.4em; color: var(--accent); }
  .comment { color: var(--text-dim); }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 1.2rem 0; }
  th, td { text-align: left; padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { color: var(--text-dim); font-weight: 500; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .note { color: var(--text-dim); font-size: 0.85rem; }
  footer { margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--border); color: var(--text-dim); font-size: 0.88rem; }
`;

function page(opts: {
  slug: string;
  title: string;
  description: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.title} — receivemail.dev</title>
<meta name="description" content="${opts.description}">
<link rel="canonical" href="https://receivemail.dev/compare/${opts.slug}">
<meta property="og:title" content="${opts.title}">
<meta property="og:description" content="${opts.description}">
<meta property="og:url" content="https://receivemail.dev/compare/${opts.slug}">
<meta property="og:type" content="article">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":${JSON.stringify(opts.title)},"description":${JSON.stringify(opts.description)},"url":"https://receivemail.dev/compare/${opts.slug}","author":{"@type":"Organization","name":"receivemail.dev","url":"https://receivemail.dev"},"publisher":{"@type":"Organization","name":"receivemail.dev","url":"https://receivemail.dev"}}
</script>
<style>${SHARED_STYLE}</style>
</head>
<body>
<div class="wrap">
  <div class="logo"><a href="/">receivemail.dev</a> / compare</div>
  <h1>${opts.title}</h1>
  <p class="meta">${opts.description}</p>
  ${opts.body}
  <footer>
    <a href="/">← receivemail.dev</a> · A disposable inbox via one API call, no signup.
    Built by the same team as <a href="https://flo-voice1.com">sms-florin</a>.
  </footer>
</div>
</body>
</html>`;
}

const MAILSLURP_ALTERNATIVE = page({
  slug: "mailslurp-alternative",
  title: "A free MailSlurp alternative for reading verification emails in tests",
  description:
    "receivemail.dev is a free, no-signup disposable inbox you read over HTTP. Here's how it compares to MailSlurp, and when each one is the right choice.",
  body: `
  <p><a href="https://www.mailslurp.com">MailSlurp</a> is a full email-infrastructure
  API — it can send and receive, gives you SMTP/IMAP access, permanent inboxes,
  custom domains, attachments, phone numbers, team accounts and a SOC 2 option. If
  you need that, MailSlurp is a solid choice and this page won't talk you out of it.</p>

  <p>But a lot of people reach for MailSlurp for one narrow job: <strong>in an
  automated test, sign up for something and read the verification email back</strong>.
  For that job specifically, you don't need an email platform — you need a throwaway
  address you can poll. That's all <a href="/">receivemail.dev</a> does, and it does
  it free with no signup.</p>

  <h2>Side by side</h2>
  <table>
    <thead><tr><th></th><th>receivemail.dev</th><th>MailSlurp</th></tr></thead>
    <tbody>
      <tr><td>Price</td><td>Free</td><td>Free tier, then paid plans (from ~$20/mo as of 2026 — see their pricing page)</td></tr>
      <tr><td>Signup / account</td><td>None</td><td>Required</td></tr>
      <tr><td>API key to create an inbox</td><td>No</td><td>Yes</td></tr>
      <tr><td>Receive email via API</td><td>Yes</td><td>Yes</td></tr>
      <tr><td>Send email</td><td>No</td><td>Yes</td></tr>
      <tr><td>SMTP / IMAP access</td><td>No</td><td>Yes</td></tr>
      <tr><td>Permanent inboxes</td><td>No — up to 60 min TTL</td><td>Yes</td></tr>
      <tr><td>Custom domains</td><td>No</td><td>Yes (paid)</td></tr>
      <tr><td>Phone / SMS</td><td>No (see <a href="https://flo-voice1.com">sms-florin</a>)</td><td>Yes</td></tr>
      <tr><td>Rate limit</td><td>20 inbox creations / min per IP</td><td>Plan-dependent</td></tr>
      <tr><td>Hosting</td><td>Cloudflare Workers</td><td>Managed SaaS</td></tr>
    </tbody>
  </table>
  <p class="note">MailSlurp's exact free-tier limits and plan prices change over
  time — check <a href="https://www.mailslurp.com/pricing/">mailslurp.com/pricing</a>
  for the current numbers.</p>

  <h2>When receivemail.dev is the better fit</h2>
  <ul>
    <li>Your test just needs to read a verification link or code — nothing more.</li>
    <li>You don't want to manage another API key, plan, or billing relationship.</li>
    <li>It's a hobby project, an open-source repo's CI, or a proof of concept.</li>
    <li>You want contributors to run the test suite without signing up for anything.</li>
    <li>You only ever <em>receive</em>; you never need to send from the address.</li>
  </ul>

  <h2>When to stay on MailSlurp (or move to it)</h2>
  <ul>
    <li>You need to <strong>send</strong> email, not just receive.</li>
    <li>You need inboxes that persist for days or weeks.</li>
    <li>You need SMTP/IMAP, custom domains, attachments handling, or webhooks.</li>
    <li>You need team accounts, audit logs, or SOC 2 for compliance.</li>
    <li>You're running high volume and want a paid SLA behind it.</li>
  </ul>

  <h2>Migrating a test</h2>
  <p>If your test currently does "create MailSlurp inbox → sign up → wait for email",
  the receivemail.dev version is:</p>
  <pre># create a mailbox — no key, no account
resp=$(curl -s -X POST https://receivemail.dev/mailboxes)
addr=$(echo "$resp" | jq -r .address)
secret=$(echo "$resp" | jq -r .secret)

# ... run your signup against $addr ...

# poll for the verification email
curl -s "https://receivemail.dev/mailboxes/$addr/messages" \\
  -H "Authorization: Bearer $secret"
<span class="comment"># => {"address":"...","messages":[{"from_address":"...","subject":"...","body_text":"..."}]}</span></pre>
  <p>There's a fuller walkthrough (shell + Playwright) in
  <a href="/guides/testing-verification-emails">the CI testing guide</a>.</p>

  <h2>Other alternatives people compare</h2>
  <ul>
    <li><strong>Mailinator</strong> — public inboxes are free but shared/visible to anyone; private inboxes and API access are paid.</li>
    <li><strong>Mailosaur</strong> — email <em>and</em> SMS testing, server-based, paid with a trial. Good if you want both channels in one paid tool.</li>
    <li><strong>Self-hosted (Mailpit, MailHog)</strong> — great when the email is sent by your own app on the same network; not usable when a third party sends to a public address.</li>
  </ul>
`,
});

export const COMPARE: Record<string, string> = {
  "mailslurp-alternative": MAILSLURP_ALTERNATIVE,
};

export const COMPARE_SLUGS = Object.keys(COMPARE);
