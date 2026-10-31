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

// Date the competitor facts below were last checked against each vendor's own
// pricing/docs page. Bump it whenever the table is re-verified.
const UPDATED_ISO = "2026-10-26";
const UPDATED_LABEL = "26 October 2026";

// Half the impressions on these pages come from plural searches
// ("mailinator alternatives") — people want a list, not a one-on-one. Each
// page leads with this list, minus the tool the page is about (its own
// side-by-side covers that one). Facts from each vendor's pricing page.
const ALTERNATIVES: { key: string; html: string }[] = [
  {
    key: "receivemail",
    html: `<tr><td><strong><a href="/">receivemail.dev</a></strong></td><td>Free, no signup; Pro $7/mo</td><td>None</td><td>Yes, no key needed</td><td>Private (per-mailbox secret)</td><td>Free 60 min, Pro 24 h</td></tr>`,
  },
  {
    key: "mailtm",
    html: `<tr><td><strong><a href="https://mail.tm">mail.tm</a></strong></td><td>Free, no paid tiers</td><td>None (mailbox created via API)</td><td>Yes, no key; 8 req/s per IP</td><td>Private (password)</td><td>Not published</td></tr>`,
  },
  {
    key: "mailsac",
    html: `<tr><td><strong><a href="/compare/mailsac-alternative">Mailsac</a></strong></td><td>Free 1,500 ops/mo; from $18/mo</td><td>For API key / private inbox</td><td>Yes, with key</td><td>Public without account; 1 private address free</td><td>Plan-dependent</td></tr>`,
  },
  {
    key: "mailinator",
    html: `<tr><td><strong><a href="/compare/mailinator-alternative">Mailinator</a></strong></td><td>Public inboxes free; Verified Pro $0 on approval; Business $79/mo (yearly)</td><td>For private inboxes / API</td><td>Not on the public tier</td><td>Public, unless on a private domain</td><td>Temporary on the public tier</td></tr>`,
  },
  {
    key: "mailslurp",
    html: `<tr><td><strong><a href="/compare/mailslurp-alternative">MailSlurp</a></strong></td><td>Free: 100 inboxes, 500 emails/mo; from $19.99/mo</td><td>Required</td><td>Yes, with key</td><td>Private</td><td>Persistent</td></tr>`,
  },
  {
    key: "mailosaur",
    html: `<tr><td><strong><a href="/compare/mailosaur-alternative">Mailosaur</a></strong></td><td>No free plan; 14-day trial, from $20/mo (yearly)</td><td>Required</td><td>Yes, with key</td><td>Private (own server/domain)</td><td>Persistent</td></tr>`,
  },
  {
    key: "testmail",
    html: `<tr><td><strong><a href="https://testmail.app">testmail.app</a></strong></td><td>Free 100 emails/mo; from $9/mo (yearly)</td><td>Required</td><td>Full API from the $9 plan</td><td>Private namespace</td><td>Free 1 day</td></tr>`,
  },
  {
    key: "mailpit",
    html: `<tr><td><strong><a href="https://mailpit.axllent.org">Mailpit</a></strong></td><td>Free, self-hosted</td><td>None (you run it)</td><td>Yes (REST)</td><td>Your own server</td><td>Your choice</td></tr>`,
  },
];

function alternativesTable(exclude: string): string {
  const rows = ALTERNATIVES.filter((a) => a.key !== exclude)
    .map((a) => a.html)
    .join("\n      ");
  return `
  <h2>Alternatives at a glance</h2>
  <table>
    <thead><tr><th>Tool</th><th>Cost</th><th>Account</th><th>Read mail via API</th><th>Inbox privacy</th><th>Retention</th></tr></thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p class="note">Checked against each vendor's pricing and docs pages on
  ${UPDATED_LABEL}. Plans change — confirm on their sites before you commit.
  Mailpit only catches mail your own app sends to it over SMTP; it can't receive
  from a third-party service sending to a public address.</p>`;
}

function faqBlock(faq: { q: string; a: string }[]): string {
  return `
  <h2>FAQ</h2>
  ${faq.map((f) => `<h3>${f.q}</h3>\n  <p>${f.a}</p>`).join("\n  ")}`;
}

function faqJsonLd(faq: { q: string; a: string }[]): string {
  const strip = (s: string) => s.replace(/<[^>]+>/g, "");
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: strip(f.a) },
    })),
  });
}

function page(opts: {
  slug: string;
  // <title> as it shows in search results: short, competitor name first, so
  // it isn't truncated and matches "X alternative(s)" queries. The longer
  // `title` stays as the on-page h1.
  seoTitle: string;
  title: string;
  description: string;
  exclude: string;
  body: string;
  faq: { q: string; a: string }[];
  // A page whose facts were checked on a different day than UPDATED_*.
  updated?: { iso: string; label: string };
}): string {
  const updatedIso = opts.updated?.iso ?? UPDATED_ISO;
  const updatedLabel = opts.updated?.label ?? UPDATED_LABEL;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.seoTitle}</title>
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon.png">
<meta name="description" content="${opts.description}">
<link rel="canonical" href="https://receivemail.dev/compare/${opts.slug}">
<meta property="og:title" content="${opts.seoTitle}">
<meta property="og:description" content="${opts.description}">
<meta property="og:url" content="https://receivemail.dev/compare/${opts.slug}">
<meta property="og:type" content="article">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":${JSON.stringify(opts.title)},"description":${JSON.stringify(opts.description)},"url":"https://receivemail.dev/compare/${opts.slug}","dateModified":"${updatedIso}","author":{"@type":"Organization","name":"receivemail.dev","url":"https://receivemail.dev"},"publisher":{"@type":"Organization","name":"receivemail.dev","url":"https://receivemail.dev"}}
</script>
<script type="application/ld+json">
${faqJsonLd(opts.faq)}
</script>
<style>${SHARED_STYLE}</style>
</head>
<body>
<div class="wrap">
  <div class="logo"><a href="/">receivemail.dev</a> / compare</div>
  <h1>${opts.title}</h1>
  <p class="meta">${opts.description} Updated ${updatedLabel}.</p>
  ${alternativesTable(opts.exclude)}
  ${opts.body}
  ${faqBlock(opts.faq)}
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
  seoTitle: "MailSlurp Alternatives: Free, No Signup | receivemail.dev",
  title: "MailSlurp alternatives for reading verification emails in tests",
  description:
    "Free MailSlurp alternatives compared — receivemail.dev, mail.tm, Mailsac, Mailinator, testmail.app, Mailosaur and Mailpit: cost, signup, API access and retention.",
  exclude: "mailslurp",
  faq: [
    {
      q: "Is there a free MailSlurp alternative with no signup?",
      a: `Yes. receivemail.dev and mail.tm both create a private inbox over the API with no account and no API key. MailSlurp itself has a free plan (100 inbox creations and 500 received emails a month), but it needs an account.`,
    },
    {
      q: "Can a free alternative replace MailSlurp in CI?",
      a: `If the test only signs up and reads back a verification code or link, yes. If it sends email, needs inboxes that persist for days, SMTP/IMAP or custom domains, stay on MailSlurp.`,
    },
    {
      q: "Does receivemail.dev extract the verification code for me?",
      a: `On the $7/mo Pro plan each message comes back with the code already extracted in an <code>otp</code> field; the $19/mo plan adds webhooks. The free tier returns the raw subject and body. See <a href="/guides/email-otp-webhook">the OTP guide</a>.`,
    },
  ],
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
      <tr><td>Price</td><td>Free; Pro $7/mo (24 h inboxes, extracted codes)</td><td>Free plan (100 inbox creations, 500 received emails / mo), paid from $19.99/mo</td></tr>
      <tr><td>Signup / account</td><td>None</td><td>Required</td></tr>
      <tr><td>API key to create an inbox</td><td>No</td><td>Yes</td></tr>
      <tr><td>Receive email via API</td><td>Yes</td><td>Yes</td></tr>
      <tr><td>Send email</td><td>No</td><td>Yes</td></tr>
      <tr><td>SMTP / IMAP access</td><td>No</td><td>Yes</td></tr>
      <tr><td>Permanent inboxes</td><td>No — up to 60 min free, 24 h on Pro</td><td>Yes</td></tr>
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
    <li>You need SMTP/IMAP, custom domains, or attachment handling.</li>
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
  seoTitle: "Mailinator Alternatives: Private & Free | receivemail.dev",
  title: "Private, free Mailinator alternatives for verification emails",
  description:
    "Mailinator's free inboxes are public and have no API. Private, free alternatives compared — receivemail.dev, mail.tm, Mailsac, MailSlurp, testmail.app and more.",
  exclude: "mailinator",
  faq: [
    {
      q: "Are Mailinator's free inboxes private?",
      a: `No. On the free Public plan any inbox can be opened by anyone who types its name, and API access isn't included. Private inboxes come with Verified Pro (free, on approval) or the paid Business plan.`,
    },
    {
      q: "What's a private Mailinator alternative with an API and no signup?",
      a: `receivemail.dev: one unauthenticated <code>POST /mailboxes</code> returns a random address plus a secret, and only that secret can read the mail. mail.tm works similarly with an address and password.`,
    },
    {
      q: "Why do some sites reject Mailinator addresses?",
      a: `It's one of the best-known disposable domains, so many signup forms block it. A less-known domain is less likely to be blocked, though no disposable domain is guaranteed to pass every filter.`,
    },
  ],
  body: `
  <p><a href="https://www.mailinator.com">Mailinator</a> has been the go-to
  throwaway inbox for well over a decade. The free version is genuinely useful for
  a quick manual check: type any name <code>@mailinator.com</code>, open the public
  inbox, read the email. For automated tests and for anything you'd rather not have
  strangers see, though, two things get in the way — the free inboxes are
  <strong>public and world-readable</strong>, and programmatic/API access plus
  private domains need Verified Pro (free, on approval) or a paid plan.</p>

  <p><a href="/">receivemail.dev</a> covers the same "read a verification email in
  a test" job, but every address is <strong>private to whoever created it</strong>
  (reads are gated by a per-mailbox secret returned at creation), and API access is
  the only interface — there's nothing to log into, and the free tier costs nothing.</p>

  <h2>Side by side</h2>
  <table>
    <thead><tr><th></th><th>receivemail.dev</th><th>Mailinator Public (free)</th><th>Mailinator Verified Pro / Business</th></tr></thead>
    <tbody>
      <tr><td>Price</td><td>Free; Pro $7/mo</td><td>Free</td><td>Verified Pro $0 on approval; Business $79/mo billed yearly</td></tr>
      <tr><td>Signup / account</td><td>None</td><td>None</td><td>Required</td></tr>
      <tr><td>Inbox privacy</td><td>Private — secret required to read</td><td>Public — anyone who guesses the name reads it</td><td>Private domain</td></tr>
      <tr><td>API to read messages</td><td>Yes</td><td>No (web UI only)</td><td>Yes</td></tr>
      <tr><td>Private / custom domain</td><td>No (shared domain, unguessable address)</td><td>No</td><td>Yes (1 on Verified Pro)</td></tr>
      <tr><td>Retention</td><td>Up to 60 min free, 24 h on Pro</td><td>Temporary</td><td>Permanent storage (10 MB on Verified Pro)</td></tr>
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
    <li>Your team wants a <strong>private shared domain</strong> everyone uses (that's what Verified Pro and Business add).</li>
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
  seoTitle: "Mailosaur Alternatives for Email Testing | receivemail.dev",
  title: "Free Mailosaur alternatives for email verification in tests",
  description:
    "Mailosaur has no free plan. Free and cheaper alternatives for reading verification emails in tests compared — receivemail.dev, mail.tm, Mailsac, MailSlurp, testmail.app and more.",
  exclude: "mailosaur",
  faq: [
    {
      q: "Does Mailosaur have a free plan?",
      a: `No. It offers a 14-day trial; paid plans start from $20/mo billed annually.`,
    },
    {
      q: "What's the cheapest Mailosaur alternative for CI email tests?",
      a: `For reading a verification code or link, receivemail.dev and mail.tm are free with no signup. Mailsac, MailSlurp and testmail.app have free tiers that need an account.`,
    },
    {
      q: "Is there an alternative that also tests SMS?",
      a: `None of the free email tools above receive SMS. For real UK numbers that receive verification texts, see <a href="https://flo-voice1.com">sms-florin</a>, from the same team as receivemail.dev.`,
    },
  ],
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
      <tr><td>Price</td><td>Free; Pro $7/mo</td><td>No free plan; 14-day trial, then from $20/mo billed annually</td></tr>
      <tr><td>Signup / account</td><td>None</td><td>Required</td></tr>
      <tr><td>Receive email via API</td><td>Yes</td><td>Yes</td></tr>
      <tr><td>SMS / phone testing</td><td>No (see <a href="https://flo-voice1.com">sms-florin</a>)</td><td>Yes</td></tr>
      <tr><td>Dedicated domain per account</td><td>No — shared domain, random address</td><td>Yes</td></tr>
      <tr><td>Email auth checks (SPF/DKIM/DMARC), spam score</td><td>No</td><td>Yes</td></tr>
      <tr><td>Official framework libraries</td><td>No — plain HTTP (plus a Playwright helper)</td><td>Yes, many</td></tr>
      <tr><td>Inbox lifetime</td><td>Up to 60 min free, 24 h on Pro</td><td>Persistent</td></tr>
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

const MAILSAC_ALTERNATIVE = page({
  slug: "mailsac-alternative",
  seoTitle: "Mailsac Alternatives: No API Key Needed | receivemail.dev",
  title: "Mailsac alternatives — no API key needed to start",
  description:
    "Mailsac's API needs an account and key. Alternatives compared — receivemail.dev and mail.tm (no key), Mailinator, MailSlurp, testmail.app, Mailosaur and Mailpit.",
  exclude: "mailsac",
  faq: [
    {
      q: "Is there a Mailsac alternative that needs no API key?",
      a: `Yes. receivemail.dev and mail.tm both let you create a private inbox and read it over the API without an account or key.`,
    },
    {
      q: "How many free operations does Mailsac give?",
      a: `1,500 operations a month and 1 private address on the free account; paid plans start at $18/mo.`,
    },
  ],
  body: `
  <p><a href="https://mailsac.com">Mailsac</a> is a mature email-testing API:
  any <code>@mailsac.com</code> address receives mail with no signup, and a free
  account adds an API key, 1 private address, and 1,500 operations a month — paid
  plans scale from there (25,000 ops/mo and up). It's a solid choice if you want a
  long-lived account with usage history and room to grow.</p>

  <p>If the job is narrower — <strong>in an automated test, sign up for something
  and read the verification email back</strong> — <a href="/">receivemail.dev</a>
  skips the account step entirely. There's no API key to generate or store, even
  for private, non-public inboxes: one unauthenticated POST creates the mailbox
  and returns a secret that gates reading it.</p>

  <h2>Side by side</h2>
  <table>
    <thead><tr><th></th><th>receivemail.dev</th><th>Mailsac</th></tr></thead>
    <tbody>
      <tr><td>Price</td><td>Free; Pro $7/mo</td><td>Free tier (1,500 ops/mo), then from $18/mo</td></tr>
      <tr><td>Signup / account</td><td>None</td><td>Not required for public inboxes; required for API key / private inboxes</td></tr>
      <tr><td>API key</td><td>No</td><td>Yes, for API access</td></tr>
      <tr><td>Private inbox without signup</td><td>Yes — every inbox is private by default</td><td>No — no-signup inboxes are public</td></tr>
      <tr><td>Operations/month limit</td><td>None published (rate-limited per IP instead)</td><td>1,500 free, then plan-based</td></tr>
      <tr><td>Own domain support</td><td>No</td><td>Yes (paid)</td></tr>
      <tr><td>Retention</td><td>Up to 60 min free, 24 h on Pro</td><td>Longer, plan-dependent</td></tr>
    </tbody>
  </table>
  <p class="note">Mailsac's plans and operation limits change over time — see
  <a href="https://mailsac.com/pricing">mailsac.com/pricing</a> for current numbers.</p>

  <h2>When receivemail.dev is enough</h2>
  <ul>
    <li>You want a private inbox without ever creating an account or key.</li>
    <li>The test only needs to read one code/link, not manage ongoing volume.</li>
    <li>You want contributors to run the suite with zero setup.</li>
  </ul>

  <h2>When to choose Mailsac instead</h2>
  <ul>
    <li>You're sending real volume and want a tracked monthly operations budget.</li>
    <li>You want your own domain receiving test mail.</li>
    <li>You want an account with history/dashboard across a team.</li>
  </ul>

  <h2>Migrating a test</h2>
  <pre><span class="comment"># Mailsac: GET /api/addresses/:email/messages with X-Mailsac-Key</span>
resp=$(curl -s -X POST https://receivemail.dev/mailboxes)
addr=$(echo "$resp" | jq -r .address)
secret=$(echo "$resp" | jq -r .secret)

<span class="comment"># ... run your signup against $addr ...</span>

curl -s "https://receivemail.dev/mailboxes/$addr/messages" \\
  -H "Authorization: Bearer $secret"</pre>
  <p>Full walkthrough: <a href="/guides/testing-verification-emails">the CI testing guide</a>.</p>

  <h2>Other alternatives people compare</h2>
  <ul>
    <li><strong>MailSlurp</strong> — full email platform, send + receive. See <a href="/compare/mailslurp-alternative">the MailSlurp comparison</a>.</li>
    <li><strong>Mailinator</strong> — free public inboxes, paid private domains. See <a href="/compare/mailinator-alternative">the Mailinator comparison</a>.</li>
    <li><strong>Mailosaur</strong> — paid email + SMS testing for QA teams. See <a href="/compare/mailosaur-alternative">the Mailosaur comparison</a>.</li>
  </ul>
`,
});

// Not a test-inbox tool like the others: Resend Inboxes gives AI agents a
// permanent address of their own. People land here from "AI agent email"
// searches, so the page says plainly which job each one does.
const RESEND_INBOXES_ALTERNATIVE = page({
  slug: "resend-inboxes-alternative",
  seoTitle: "Resend Inboxes Alternative for Tests | receivemail.dev",
  title: "Resend Inboxes vs receivemail.dev — permanent agent inbox or throwaway test inbox",
  description:
    "Resend Inboxes gives an AI agent a permanent address it can send and receive from. receivemail.dev gives you throwaway, receive-only addresses for tests — no signup, no inbox cap.",
  exclude: "",
  updated: { iso: "2026-10-31", label: "31 October 2026" },
  faq: [
    {
      q: "Is receivemail.dev a replacement for Resend Inboxes?",
      a: `Only for one job: receiving email in tests. It can't send mail, and its addresses expire after at most 60 minutes (24 h on Pro). For an agent that needs its own long-lived address, use Resend Inboxes.`,
    },
    {
      q: "How many inboxes do I get for free?",
      a: `receivemail.dev has no inbox cap: create as many as your tests need, up to 20 a minute per IP. Resend's free plan lists up to 3 inboxes and 3,000 emails sent or received.`,
    },
    {
      q: "Do I need an account?",
      a: `Not for receivemail.dev: one unauthenticated <code>POST /mailboxes</code> returns an address and a secret. Resend Inboxes is part of a Resend account.`,
    },
  ],
  body: `
  <p><a href="https://resend.com/products/inboxes">Resend Inboxes</a> gives each AI
  agent an email address of its own: it can receive mail, reply and send, as part
  of a Resend account. The free plan lists up to 3 inboxes and 3,000 emails sent
  or received. It fits an agent that needs to be reachable at the same address
  for weeks — taking tasks, approvals or replies by email.</p>

  <p><a href="/">receivemail.dev</a> does a narrower job: <strong>create a fresh
  address from code, receive one email, read it, throw the address away.</strong>
  No account, no key, no limit on how many inboxes you create (only a rate limit:
  20 a minute per IP). That is what a test suite or an agent testing a signup
  flow needs — a new address every run, never reused.</p>

  <h2>Side by side</h2>
  <table>
    <thead><tr><th></th><th>receivemail.dev</th><th>Resend Inboxes</th></tr></thead>
    <tbody>
      <tr><td>Made for</td><td>Tests: verification emails, signup flows</td><td>AI agents with a permanent address</td></tr>
      <tr><td>Account / signup</td><td>None</td><td>Resend account</td></tr>
      <tr><td>Free inboxes</td><td>No cap (20 new per minute per IP)</td><td>Up to 3</td></tr>
      <tr><td>Free email volume</td><td>No monthly quota (rate-limited instead)</td><td>3,000 emails sent/received</td></tr>
      <tr><td>Send email</td><td>No — receive only</td><td>Yes</td></tr>
      <tr><td>Address lifetime</td><td>1–60 min free, up to 24 h on Pro</td><td>Permanent</td></tr>
      <tr><td>Verification code extracted</td><td>Yes, <code>otp</code> field on Pro</td><td>—</td></tr>
      <tr><td>Push instead of polling</td><td>Signed webhooks on Pro + Webhooks ($19/mo)</td><td>Yes</td></tr>
    </tbody>
  </table>
  <p class="note">Resend's details from <a href="https://resend.com/products/inboxes">resend.com/products/inboxes</a>
  on 31 October 2026 — check there for current plans.</p>

  <h2>When receivemail.dev fits</h2>
  <ul>
    <li>Every test run needs a brand-new address, often many in parallel.</li>
    <li>You only need to read a code or link, then forget the address.</li>
    <li>You don't want an account or key in CI, or for contributors running the suite.</li>
  </ul>

  <h2>When Resend Inboxes fits</h2>
  <ul>
    <li>Your agent must keep the same address and be emailed by people over time.</li>
    <li>It needs to reply or send, not just receive.</li>
    <li>You already send through Resend and want the inbox in the same account.</li>
  </ul>

  <h2>A throwaway inbox in two calls</h2>
  <pre>resp=$(curl -s -X POST https://receivemail.dev/mailboxes)
addr=$(echo "$resp" | jq -r .address)
secret=$(echo "$resp" | jq -r .secret)

<span class="comment"># ... sign up somewhere with $addr ...</span>

curl -s "https://receivemail.dev/mailboxes/$addr/wait?timeout=25" \\
  -H "Authorization: Bearer $secret"</pre>
  <p>More recipes: <a href="/guides/testing-verification-emails">the CI testing guide</a>
  and <a href="/guides/email-otp-webhook">codes without regex or polling</a>.</p>
`,
});

export const COMPARE: Record<string, string> = {
  "mailslurp-alternative": MAILSLURP_ALTERNATIVE,
  "mailinator-alternative": MAILINATOR_ALTERNATIVE,
  "mailosaur-alternative": MAILOSAUR_ALTERNATIVE,
  "mailsac-alternative": MAILSAC_ALTERNATIVE,
  "resend-inboxes-alternative": RESEND_INBOXES_ALTERNATIVE,
};

export const COMPARE_SLUGS = Object.keys(COMPARE);
