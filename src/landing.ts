export const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>receivemail.dev — disposable email addresses via API</title>
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon.png">
<meta name="description" content="Get a real, receiving email address with one API call. No signup, no SMTP setup. Built for testing signup flows, verification emails, and QA automation.">
<style>
  :root {
    --bg: #0b0d10;
    --bg-raised: #14171b;
    --border: #262b31;
    --text: #e8eaed;
    --text-dim: #9aa4af;
    --accent: #5eead4;
    --accent-dim: #2d5f56;
    --mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    line-height: 1.6;
  }
  .wrap {
    max-width: 760px;
    margin: 0 auto;
    padding: 4rem 1.5rem 6rem;
  }
  header { margin-bottom: 3rem; }
  .logo {
    font-family: var(--mono);
    font-size: 0.95rem;
    color: var(--accent);
    letter-spacing: 0.02em;
  }
  h1 {
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    line-height: 1.15;
    margin: 1rem 0 0.75rem;
    text-wrap: balance;
  }
  .lede {
    color: var(--text-dim);
    font-size: 1.1rem;
    max-width: 46ch;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    font-family: var(--mono);
    font-size: 0.8rem;
    color: var(--accent);
    background: var(--accent-dim);
    border-radius: 999px;
    padding: 0.3em 0.9em;
    margin-top: 1.25rem;
  }
  .badge::before { content: "●"; font-size: 0.6em; }
  section { margin-top: 3.5rem; }
  h2 {
    font-size: 1.05rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    margin-bottom: 1rem;
  }
  pre {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.1rem 1.3rem;
    overflow-x: auto;
    font-family: var(--mono);
    font-size: 0.85rem;
    color: #d1e8e2;
  }
  pre + pre { margin-top: 0.75rem; }
  .comment { color: var(--text-dim); }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92rem;
  }
  th, td {
    text-align: left;
    padding: 0.6rem 0.8rem;
    border-bottom: 1px solid var(--border);
  }
  th { color: var(--text-dim); font-weight: 500; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; }
  td code, p code {
    font-family: var(--mono);
    font-size: 0.85rem;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.1em 0.4em;
    color: var(--accent);
  }
  ul.limits { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
  ul.limits li { color: var(--text-dim); font-size: 0.95rem; }
  ul.limits strong { color: var(--text); font-weight: 600; }
  footer {
    margin-top: 4.5rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
    color: var(--text-dim);
    font-size: 0.88rem;
  }
  a { color: var(--accent); }
  .pro-box { border: 1px solid var(--border); border-radius: 10px; padding: 1.2rem 1.3rem; background: var(--bg-raised); display: grid; gap: 0.55rem; }
  .pro-box label { color: var(--text-dim); font-size: 0.95rem; display: flex; gap: 0.6rem; align-items: center; cursor: pointer; }
  .pro-box input[type="checkbox"] { accent-color: var(--accent); width: 1rem; height: 1rem; }
  .pro-box input[type="text"], .pro-box input[type="email"] { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.85rem; color: var(--text); font-size: 0.95rem; font-family: var(--sans); }
  .pro-row { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.3rem; }
  .pro-row input { flex: 1; min-width: 200px; }
  .pro-box button { background: var(--accent); color: #0b0d10; border: none; border-radius: 8px; padding: 0.6rem 1.1rem; font-weight: 600; font-size: 0.92rem; cursor: pointer; }
  .pro-box button:disabled { opacity: 0.6; cursor: default; }
  .pro-status { margin: 0.3rem 0 0; font-size: 0.92rem; color: var(--accent); }
  [hidden] { display: none !important; }
  @media (prefers-reduced-motion: no-preference) {
    .wrap { animation: fade-in 0.4s ease-out; }
  }
  @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo">receivemail.dev</div>
    <h1>A real inbox, on demand. One API call, no signup.</h1>
    <p class="lede">Spin up a disposable email address that actually receives mail, then poll it from your test suite or your own script. Built for verification-email testing, signup-flow QA, and anywhere you'd otherwise burn a real inbox.</p>
    <span class="badge">Free — no API key required to create a mailbox</span>
  </header>

  <section>
    <h2>Quickstart</h2>
    <pre># create a mailbox (default: expires in 15 min)
curl -X POST https://receivemail.dev/mailboxes
<span class="comment"># => {"address":"a1b2c3d4e5f6@receivemail.dev","expiresAt":"...","secret":"..."}</span></pre>
    <pre># now trigger your app's verification email to that address, then poll:
curl https://receivemail.dev/mailboxes/a1b2c3d4e5f6@receivemail.dev/messages \\
  -H "Authorization: Bearer &lt;secret from above&gt;"
<span class="comment"># => {"address":"...","messages":[{"from_address":"...","subject":"...","body_text":"..."}]}</span></pre>
  </section>

  <section>
    <h2>Need the SMS code too?</h2>
    <p>Plenty of signups ask for a phone number after the email. <a href="https://flo-voice1.com/?ref=receivemail-site">sms-florin</a> rents real UK numbers that receive the verification SMS — same idea as this, by API or in the browser, pay per code.</p>
  </section>

  <section>
    <h2>Endpoints</h2>
    <table>
      <thead><tr><th>Endpoint</th><th>Description</th></tr></thead>
      <tbody>
        <tr><td><code>POST /mailboxes</code></td><td>Create a new address. Optional <code>{"ttlMinutes": 1-60}</code> body, default 15. Returns the address and a per-mailbox <code>secret</code> — save it, it's the only way to read this mailbox later.</td></tr>
        <tr><td><code>GET /mailboxes/:address</code></td><td>Mailbox metadata (created/expiry). Needs the mailbox's own secret as a Bearer token.</td></tr>
        <tr><td><code>GET /mailboxes/:address/messages</code></td><td>Last 50 messages received, newest first. Same secret.</td></tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>Limits</h2>
    <ul class="limits">
      <li><strong>20</strong> mailbox creations / minute per IP</li>
      <li><strong>60 minutes</strong> max mailbox lifetime — this is for short-lived test flows, not a permanent inbox</li>
      <li>Messages are pruned <strong>24h</strong> after their mailbox expires</li>
      <li>Any address at <code>@receivemail.dev</code> accepts mail, even ones never explicitly reserved — but only a reserved address gives you a secret to read it back</li>
    </ul>
  </section>

  <section id="pro">
    <h2>Need more than the free tier?</h2>
    <p style="color:var(--text-dim)">We're considering a paid plan for teams that outgrow the limits above. Tick what you'd actually pay for and leave your email — we'll only write to you about this.</p>
    <form id="pro-form" class="pro-box">
      <label><input type="checkbox" name="f" value="private_domain"> Private inboxes on your own domain</label>
      <label><input type="checkbox" name="f" value="higher_limits"> Higher limits (more mailboxes per minute / day)</label>
      <label><input type="checkbox" name="f" value="longer_retention"> Longer mailbox lifetime and retention</label>
      <label><input type="checkbox" name="f" value="webhooks"> Webhooks — push new mail to you instead of polling</label>
      <label><input type="checkbox" name="f" value="html_attachments"> HTML bodies and attachments</label>
      <input type="text" id="pro-note" maxlength="500" placeholder="Anything else? (optional)">
      <div class="pro-row">
        <input type="email" id="pro-email" placeholder="you@company.com" required autocomplete="email">
        <button type="submit" id="pro-btn">Notify me</button>
      </div>
      <p id="pro-status" class="pro-status" hidden></p>
    </form>
  </section>

  <section>
    <h2>Guides</h2>
    <ul class="limits">
      <li><a href="/faq">FAQ</a> — Playwright and Cypress recipes, limits, retention</li>
      <li><a href="/guides/testing-verification-emails">How to test email verification flows in CI</a> — shell and Playwright recipes</li>
      <li><a href="/compare/mailslurp-alternative">A free MailSlurp alternative for reading verification emails in tests</a></li>
      <li><a href="/compare/mailinator-alternative">A private, free Mailinator alternative for verification emails</a></li>
      <li><a href="/compare/mailosaur-alternative">A free Mailosaur alternative for email verification in tests</a></li>
      <li><a href="/compare/mailsac-alternative">A free Mailsac alternative — no API key needed to start</a></li>
    </ul>
  </section>

  <footer>
    Built by the same team as <a href="https://flo-voice1.com/?ref=receivemail-site">sms-florin</a> (rent a real phone number for SMS/OTP codes) — same idea, for email instead of SMS.
  </footer>
</div>
<script>
(function () {
  var form = document.getElementById('pro-form');
  var btn = document.getElementById('pro-btn');
  var status = document.getElementById('pro-status');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var features = Array.prototype.map.call(form.querySelectorAll('input[name="f"]:checked'), function (c) { return c.value; });
    btn.disabled = true;
    btn.textContent = 'Sending…';
    fetch('/pro-interest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('pro-email').value.trim(),
        features: features,
        note: document.getElementById('pro-note').value.trim()
      })
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.d.error || 'something went wrong');
        status.textContent = "Thanks — you're on the list. We'll email you if we build it.";
        status.hidden = false;
        btn.textContent = 'Done';
      })
      .catch(function (err) {
        status.textContent = 'Could not save that: ' + err.message;
        status.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Notify me';
      });
  });
})();
</script>
</body>
</html>`;
