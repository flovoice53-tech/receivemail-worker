// Static HTML guide pages, served from GET /guides/:slug. Same self-contained
// dark dev-tool styling as the landing page, no external assets. These exist
// mostly to be found in search for "test verification email" / "disposable
// email API" style queries and to give the API real context.

export const SHARED_STYLE = `
  :root {
    --bg: #0b0d10; --bg-raised: #14171b; --border: #262b31;
    --text: #e8eaed; --text-dim: #9aa4af; --accent: #5eead4;
    --mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--sans); line-height: 1.65; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 3.5rem 1.5rem 6rem; }
  .logo { font-family: var(--mono); font-size: 0.9rem; color: var(--accent); }
  .logo a { color: var(--accent); text-decoration: none; }
  h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); line-height: 1.2; margin: 1.2rem 0 0.5rem; text-wrap: balance; }
  .meta { color: var(--text-dim); font-size: 0.9rem; margin-bottom: 2.5rem; }
  h2 { font-size: 1.15rem; margin: 2.5rem 0 0.8rem; }
  p { margin: 0 0 1rem; }
  ul, ol { color: var(--text-dim); padding-left: 1.3rem; }
  li { margin-bottom: 0.4rem; }
  a { color: var(--accent); }
  pre { background: var(--bg-raised); border: 1px solid var(--border); border-radius: 10px; padding: 1.1rem 1.3rem; overflow-x: auto; font-family: var(--mono); font-size: 0.83rem; color: #d1e8e2; }
  code { font-family: var(--mono); font-size: 0.85rem; }
  p code, li code { background: var(--bg-raised); border: 1px solid var(--border); border-radius: 4px; padding: 0.1em 0.4em; color: var(--accent); }
  .comment { color: var(--text-dim); }
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
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon.png">
<meta name="description" content="${opts.description}">
<link rel="canonical" href="https://receivemail.dev/guides/${opts.slug}">
<meta property="og:title" content="${opts.title}">
<meta property="og:description" content="${opts.description}">
<meta property="og:url" content="https://receivemail.dev/guides/${opts.slug}">
<meta property="og:type" content="article">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":${JSON.stringify(opts.title)},"description":${JSON.stringify(opts.description)},"url":"https://receivemail.dev/guides/${opts.slug}","author":{"@type":"Organization","name":"receivemail.dev","url":"https://receivemail.dev"},"publisher":{"@type":"Organization","name":"receivemail.dev","url":"https://receivemail.dev"}}
</script>
<style>${SHARED_STYLE}</style>
</head>
<body>
<div class="wrap">
  <div class="logo"><a href="/">receivemail.dev</a> / guides</div>
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

const TESTING_VERIFICATION_EMAILS = page({
  slug: "testing-verification-emails",
  title: "How to test email verification flows in CI",
  description:
    "A practical way to test signup and email-verification flows end to end in an automated pipeline, using a disposable inbox you can read over HTTP.",
  body: `
  <p>Most signup flows send a verification email with a link or a code. That step is
  easy to leave untested because it needs a real inbox — so teams stub it out, and
  then a broken template or a dead link ships to production. You can test it for real
  instead: create a throwaway address, run your signup, and read the email back over
  HTTP.</p>

  <h2>The idea</h2>
  <ol>
    <li>Ask <code>receivemail.dev</code> for a fresh address. You get back the address and a
    per-mailbox <code>secret</code> used to read it later.</li>
    <li>Run your normal signup with that address.</li>
    <li>Poll the mailbox until the verification email shows up, then pull the link or
    code out of the body and finish the flow.</li>
  </ol>

  <h2>Plain shell (works in any CI)</h2>
  <pre># 1. create the mailbox
resp=$(curl -s -X POST https://receivemail.dev/mailboxes)
addr=$(echo "$resp" | jq -r .address)
secret=$(echo "$resp" | jq -r .secret)

# 2. run your signup against $addr (your app / your API call here)
curl -s -X POST https://your-app.example/api/signup \\
  -H 'content-type: application/json' \\
  -d "{\\"email\\":\\"$addr\\",\\"password\\":\\"test-Pa55w0rd\\"}"

# 3. poll for the verification mail (up to ~30s)
for i in $(seq 1 15); do
  body=$(curl -s "https://receivemail.dev/mailboxes/$addr/messages" \\
    -H "Authorization: Bearer $secret")
  link=$(echo "$body" | jq -r '.messages[0].body_text // ""' \\
    | grep -oE 'https://your-app\\.example/verify\\?token=[A-Za-z0-9._-]+' | head -1)
  [ -n "$link" ] && break
  sleep 2
done

# 4. hit the verification link
test -n "$link" && curl -s -o /dev/null -w '%{http_code}\\n' "$link"</pre>

  <h2>Playwright</h2>
  <pre>import { test, expect, request } from '@playwright/test';

test('new user can verify their email', async ({ page }) => {
  const api = await request.newContext();

  // fresh inbox
  const mb = await (await api.post('https://receivemail.dev/mailboxes')).json();

  // sign up through the real UI
  await page.goto('/signup');
  await page.getByLabel('Email').fill(mb.address);
  await page.getByLabel('Password').fill('test-Pa55w0rd');
  await page.getByRole('button', { name: 'Create account' }).click();

  // wait for the verification email to land
  let link: string | undefined;
  await expect.poll(async () => {
    const res = await api.get(
      \`https://receivemail.dev/mailboxes/\${mb.address}/messages\`,
      { headers: { Authorization: \`Bearer \${mb.secret}\` } },
    );
    const msg = (await res.json()).messages[0];
    link = msg?.body_text?.match(/https:\\/\\/[^\\s"]+verify[^\\s"]*/)?.[0];
    return Boolean(link);
  }, { timeout: 30_000 }).toBe(true);

  await page.goto(link!);
  await expect(page.getByText('Email verified')).toBeVisible();
});</pre>

  <h2>Or use the fixture packages</h2>
  <p>The polling boilerplate is packaged up so you don't have to copy it:</p>
  <pre>npm i -D playwright-receivemail   <span class="comment"># or: cypress-receivemail</span></pre>
  <pre>import { test, expect } from 'playwright-receivemail';

test('new user can verify their email', async ({ page, mailbox }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(mailbox.address);
  await page.getByLabel('Password').fill('test-Pa55w0rd');
  await page.getByRole('button', { name: 'Create account' }).click();

  const link = await mailbox.waitForMatch(/https:\\/\\/[^\\s"]+verify[^\\s"]*/, {
    subjectContains: 'verify',
  });
  await page.goto(link);
  await expect(page.getByText('Email verified')).toBeVisible();
});</pre>
  <p>Cypress: <code>cy.createMailbox()</code>, then
  <code>cy.getEmailMatch(/\\d{6}/)</code> for a code or a link regex. See
  <a href="https://www.npmjs.com/package/playwright-receivemail">playwright-receivemail</a>
  / <a href="https://www.npmjs.com/package/cypress-receivemail">cypress-receivemail</a>.</p>

  <h2>Notes</h2>
  <ul>
    <li>No API key is needed to <em>create</em> a mailbox. Reading it back needs the
    <code>secret</code> from the create response.</li>
    <li>Mailboxes live up to 60 minutes — plenty for a test run, not a place to park
    real mail.</li>
    <li>Any address <code>@receivemail.dev</code> accepts mail, so you can also hard-code a
    known address for a fixture, then read it with the admin token.</li>
    <li>Rate limit is 20 mailbox creations per minute per IP — fine for a normal test
    suite, worth batching if you fan out hundreds of parallel jobs.</li>
    <li>Testing an <strong>SMS</strong> code instead of an email link? The same pattern works with
    a rented phone number — see <a href="https://flo-voice1.com">sms-florin</a>, or
    <a href="https://otpwatch.flo-voice1.com">otp-watch</a> if you want it as a ready-made
    delivery check.</li>
  </ul>
`,
});

const OTP_WEBHOOK = page({
  slug: "email-otp-webhook",
  title: "Get email verification codes without regex or polling",
  description:
    "Two ways to stop hand-parsing verification emails in tests: read a pre-extracted otp field, or have every email pushed to your webhook the moment it arrives.",
  body: `
  <p>The usual way to test an email-verification step is: create an inbox, trigger the
  signup, then poll the inbox every couple of seconds and run a regex over the body to
  find the code. It works, but it's the flakiest part of a signup test — the regex
  breaks when someone edits the email template, and the poll interval is either too
  slow (wasted CI minutes) or too fast (rate limits).</p>
  <p>receivemail.dev's paid plans remove both halves of that. Both use an API key,
  shown right after checkout, sent as <code>Authorization: Bearer rmk_…</code> when
  you create the mailbox.</p>

  <h2>1. The code, already extracted (Pro, $7/mo)</h2>
  <p>Mailboxes created with a key return every message with an <code>otp</code> field —
  the verification code pulled out for you (a number next to "code", "OTP",
  "verify"…, or the lone 4–8 digit number in the email, ignoring things like a
  copyright year). No regex in your test:</p>
  <pre>resp=$(curl -s -X POST https://receivemail.dev/mailboxes \\
  -H "Authorization: Bearer $RECEIVEMAIL_KEY")
addr=$(echo "$resp" | jq -r .address)
secret=$(echo "$resp" | jq -r .secret)

# ...trigger your signup with $addr...

for i in $(seq 1 15); do
  otp=$(curl -s "https://receivemail.dev/mailboxes/$addr/messages" \\
    -H "Authorization: Bearer $secret" | jq -r '.messages[0].otp // empty')
  [ -n "$otp" ] && break
  sleep 2
done
echo "code: $otp"</pre>
  <p>Paid mailboxes also live up to 24 hours instead of 60 minutes, and a key gets 120
  creates per minute instead of the free per-IP limit — useful when many CI jobs run
  in parallel behind one NAT address.</p>

  <h2>2. Pushed to you instead of polled (Pro + Webhooks, $19/mo)</h2>
  <p>Pass a <code>webhookUrl</code> when creating the mailbox and every email that lands
  is POSTed there within about a second, as JSON:</p>
  <pre>curl -X POST https://receivemail.dev/mailboxes \\
  -H "Authorization: Bearer $RECEIVEMAIL_KEY" \\
  -H 'content-type: application/json' \\
  -d '{"ttlMinutes": 1440, "webhookUrl": "https://test-harness.example.com/hooks/email"}'</pre>
  <pre>{
  "address": "7f2b0094b9fc@receivemail.dev",
  "from": "noreply@your-app.example",
  "subject": "Your verification code",
  "bodyText": "Your verification code is 739204...",
  "otp": "739204",
  "receivedAt": "2026-10-16T03:42:38.226Z"
}</pre>
  <p>Each request carries <code>X-Receivemail-Signature</code>: the hex HMAC-SHA256 of the
  raw body, keyed with your API key. Verify it before trusting the payload:</p>
  <pre>import express from 'express';
import crypto from 'node:crypto';

const app = express();
app.post('/hooks/email', express.raw({ type: 'application/json' }), (req, res) => {
  const expected = crypto.createHmac('sha256', process.env.RECEIVEMAIL_KEY)
    .update(req.body).digest('hex');
  const given = req.get('x-receivemail-signature') ?? '';
  if (given.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return res.sendStatus(401);
  }
  const mail = JSON.parse(req.body);
  console.log(mail.address, mail.otp);   // hand the code to whatever is waiting on it
  res.sendStatus(200);
});
app.listen(3000);</pre>

  <h2>When a webhook fits — and when it doesn't</h2>
  <ul>
    <li>A webhook needs a <strong>public https URL</strong>. A normal CI runner doesn't
    have one, so for a plain CI test the <code>otp</code> field from option 1 is
    usually the simpler win.</li>
    <li>Webhooks fit when something long-running is listening: a staging test harness, a
    QA dashboard, a monitoring job, or an AI agent working through a signup and waiting
    for the code.</li>
    <li>Only public https hostnames are accepted — no plain http, IP addresses or
    localhost. For a quick local experiment, put a tunnel (cloudflared, ngrok) in
    front of your listener.</li>
    <li>Delivery is attempted twice. The message is also stored as usual, so you can
    always fall back to reading it over the API.</li>
  </ul>
  <p>Both plans are on the <a href="/#pro">pricing section</a>; the free API stays free
  and unchanged.</p>
`,
});

export const GUIDES: Record<string, string> = {
  "testing-verification-emails": TESTING_VERIFICATION_EMAILS,
  "email-otp-webhook": OTP_WEBHOOK,
};

export const GUIDE_SLUGS = Object.keys(GUIDES);
