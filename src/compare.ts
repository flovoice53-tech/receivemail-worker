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

const MAILINATOR_ALTERNATIVE = page({
  slug: "mailinator-alternative",
  title: "A private, free Mailinator alternative for verification emails",
  description:
    "Mailinator's free inboxes are public — anyone can read them. receivemail.dev gives you a private throwaway inbox over one API call, still free, still no signup.",
  body: `
  <p><a href="https://www.mailinator.com">Mailinator</a> has been the go-to
  throwaway inbox for well over a decade. The free version is genuinely useful for
  a quick manual check: type any name <code>@mailinator.com</code>, open the public
  inbox, read the email. For automated tests and for anything you'd rather not have
  strangers see, though, two things get in the way — the free inboxes are
  <strong>public and world-readable</strong>, and programmatic/API access plus
  private domains are on the paid plans.</p>

  <p><a href="/">receivemail.dev</a> covers the same "read a verification email in
  a test" job, but every address is <strong>private to whoever created it</strong>
  (reads are gated by a per-mailbox secret returned at creation), and API access is
  the only interface — there's nothing to log into and nothing to pay.</p>

  <h2>Side by side</h2>
  <table>
    <thead><tr><th></th><th>receivemail.dev</th><th>Mailinator (free)</th><th>Mailinator (paid)</th></tr></thead>
    <tbody>
      <tr><td>Price</td><td>Free</td><td>Free</td><td>From ~$59/mo (check current pricing)</td></tr>
      <tr><td>Signup / account</td><td>None</td><td>None</td><td>Required</td></tr>
      <tr><td>Inbox privacy</td><td>Private — secret required to read</td><td>Public — anyone who guesses the name reads it</td><td>Private team domain</td></tr>
      <tr><td>API to read messages</td><td>Yes</td><td>No (web UI / RSS only)</td><td>Yes</td></tr>
      <tr><td>Private / custom domain</td><td>No (shared domain, unguessable address)</td><td>No</td><td>Yes</td></tr>
      <tr><td>Retention</td><td>Up to 60 min TTL</td><td>A few hours, best-effort</td><td>Configurable</td></tr>
      <tr><td>Send email</td><td>No</td><td>No</td><td>No</td></tr>
      <tr><td>Good for</td><td>Automated tests, CI, throwaway checks</td><td>One-off manual checks</td><td>QA teams needing a private shared domain</td></tr>
    </tbody>
  </table>
  <p class="note">Mailinator's plan names and prices change — see
  <a href="https://www.mailinator.com/pricing/">mailinator.com/pricing</a> for
  the current numbers.</p>

  <h2>Why "public inbox" matters in a test</h2>
  <ul>
    <li>Anyone watching <code>@mailinator.com</code> can see the verification codes
    your test triggers — and, if your signup flow leaks anything else (names,
    reset links), that too.</li>
    <li>Addresses are guessable, so another user (or a bot) can land on the same
    inbox you're using and your test reads their message instead of yours.</li>
    <li>Some services now block <code>mailinator.com</code> outright at signup
    because it's so well known.</li>
  </ul>
  <p>receivemail.dev hands you a random address on a less-burned domain and only
  the holder of the creation secret can read it.</p>

  <h2>When Mailinator is still the right call</h2>
  <ul>
    <li>You just want to eyeball one email by hand — the public inbox is faster than any API.</li>
    <li>Your team wants a <strong>private shared domain</strong> everyone uses (that's the paid plan's core value).</li>
    <li>You need messages to stick around longer than an hour.</li>
    <li>You're already invested in Mailinator's rule-based routing / webhooks.</li>
  </ul>

  <h2>Moving a test over</h2>
  <pre><span class="comment"># was: hit https://api.mailinator.com/... with an API token</span>
resp=$(curl -s -X POST https://receivemail.dev/mailboxes)
addr=$(echo "$resp" | jq -r .address)
secret=$(echo "$resp" | jq -r .secret)

<span class="comment"># ... run your signup against $addr ...</span>

curl -s "https://receivemail.dev/mailboxes/$addr/messages" \\
  -H "Authorization: Bearer $secret"</pre>
  <p>Full shell + Playwright walkthrough:
  <a href="/guides/testing-verification-emails">the CI testing guide</a>.</p>

  <h2>Other alternatives people compare</h2>
  <ul>
    <li><strong>MailSlurp</strong> — a full email platform (send + receive, SMTP/IMAP, permanent inboxes). See <a href="/compare/mailslurp-alternative">the MailSlurp comparison</a>.</li>
    <li><strong>Mailosaur</strong> — paid email <em>and</em> SMS testing for QA teams. See <a href="/compare/mailosaur-alternative">the Mailosaur comparison</a>.</li>
    <li><strong>mail.tm / DropMail</strong> — also free, no-signup, API-accessible; similar niche to receivemail.dev with different retention and rate limits.</li>
  </ul>
`,
});

const MAILOSAUR_ALTERNATIVE = page({
  slug: "mailosaur-alternative",
  title: "A free Mailosaur alternative for email verification in tests",
  description:
    "Mailosaur is a paid email + SMS testing platform for QA teams. If you only need to read a verification email in an automated test, receivemail.dev does that free with no signup.",
  body: `
  <p><a href="https://mailosaur.com">Mailosaur</a> is a polished, paid testing
  platform: dedicated email servers, a real domain per account, SMS testing with
  virtual numbers, deep assertions (SPF/DKIM/DMARC checks, spam scoring, link and
  attachment inspection), and first-party libraries for most test frameworks. For a
  QA team that tests email and SMS seriously, it's a strong tool and this page
  isn't trying to move you off it.</p>

  <p>Plenty of projects, though, only need one thing from a tool like this: in an
  automated test, <strong>sign up and read back the verification email</strong>.
  For that, <a href="/">receivemail.dev</a> does the job with no account and no
  cost — you create a disposable inbox with one unauthenticated POST and poll it
  for messages.</p>

  <h2>Side by side</h2>
  <table>
    <thead><tr><th></th><th>receivemail.dev</th><th>Mailosaur</th></tr></thead>
    <tbody>
      <tr><td>Price</td><td>Free</td><td>Paid, with a free trial (check current pricing)</td></tr>
      <tr><td>Signup / account</td><td>None</td><td>Required</td></tr>
      <tr><td>Receive email via API</td><td>Yes</td><td>Yes</td></tr>
      <tr><td>SMS / phone testing</td><td>No (see <a href="https://flo-voice1.com">sms-florin</a>)</td><td>Yes</td></tr>
      <tr><td>Dedicated domain per account</td><td>No — shared domain, random address</td><td>Yes</td></tr>
      <tr><td>Email auth checks (SPF/DKIM/DMARC), spam score</td><td>No</td><td>Yes</td></tr>
      <tr><td>Official framework libraries</td><td>No — plain HTTP (plus a Playwright helper)</td><td>Yes, many</td></tr>
      <tr><td>Inbox lifetime</td><td>Up to 60 min TTL</td><td>Persistent</td></tr>
      <tr><td>Best for</td><td>Reading a code/link in CI, hobby projects, OSS</td><td>QA teams testing email & SMS as a discipline</td></tr>
    </tbody>
  </table>
  <p class="note">Mailosaur's plans and limits change over time — see
  <a href="https://mailosaur.com/pricing">mailosaur.com/pricing</a> for current
  details.</p>

  <h2>When receivemail.dev is enough</h2>
  <ul>
    <li>The assertion you actually make is "a message arrived and it contains this code/link" — nothing about headers, deliverability, or spam.</li>
    <li>You don't want another paid tool in the stack for one test.</li>
    <li>Contributors should be able to run the suite without credentials.</li>
    <li>It's a side project, a demo, or an open-source repo's CI.</li>
  </ul>

  <h2>When to choose Mailosaur instead</h2>
  <ul>
    <li>You test <strong>SMS and email</strong> and want them in one tool.</li>
    <li>You assert on SPF/DKIM/DMARC, spam score, or rendered HTML.</li>
    <li>You want a dedicated domain and persistent inboxes.</li>
    <li>You want vendor-supported libraries and a support contract.</li>
    <li>Deliverability itself is under test, not just message content.</li>
  </ul>

  <h2>Migrating a test</h2>
  <pre><span class="comment"># Mailosaur: new MailosaurClient(key); server + messages.get(...)</span>
resp=$(curl -s -X POST https://receivemail.dev/mailboxes)
addr=$(echo "$resp" | jq -r .address)
secret=$(echo "$resp" | jq -r .secret)

<span class="comment"># ... run your signup against $addr ...</span>

curl -s "https://receivemail.dev/mailboxes/$addr/messages" \\
  -H "Authorization: Bearer $secret"
<span class="comment"># => {"messages":[{"from_address":"...","subject":"...","body_text":"..."}]}</span></pre>
  <p>Playwright version and more detail:
  <a href="/guides/testing-verification-emails">the CI testing guide</a>.</p>

  <h2>Other alternatives people compare</h2>
  <ul>
    <li><strong>MailSlurp</strong> — email infrastructure API, send + receive. See <a href="/compare/mailslurp-alternative">the MailSlurp comparison</a>.</li>
    <li><strong>Mailinator</strong> — free public inboxes, paid private domains + API. See <a href="/compare/mailinator-alternative">the Mailinator comparison</a>.</li>
    <li><strong>Self-hosted (Mailpit, MailHog)</strong> — ideal when your own app sends the mail on the same network; not an option when a third party sends to a public address.</li>
  </ul>
`,
});

export const COMPARE: Record<string, string> = {
  "mailslurp-alternative": MAILSLURP_ALTERNATIVE,
  "mailinator-alternative": MAILINATOR_ALTERNATIVE,
  "mailosaur-alternative": MAILOSAUR_ALTERNATIVE,
};

export const COMPARE_SLUGS = Object.keys(COMPARE);
