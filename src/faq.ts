// GET /faq — the questions a developer (or an AI assistant answering one)
// actually asks about testing email flows, with answers checked against the
// code in index.ts: limits, TTLs, retention and fields must stay in step
// with it. Also emitted as FAQPage structured data.
import { SHARED_STYLE } from "./guides.js";

type Faq = { q: string; a: string; text: string };

const FAQ: Faq[] = [
  {
    q: "What is receivemail.dev?",
    a: `<p>A free, real email inbox for automated tests. One API call gives you a fresh <code>@receivemail.dev</code> address; you point your app's signup or password-reset flow at it, then read what arrives. No account, no API key.</p>`,
    text: "A free, real email inbox for automated tests. One API call gives you a fresh @receivemail.dev address; you point your app's signup or password-reset flow at it, then read what arrives. No account, no API key.",
  },
  {
    q: "How do I test an email verification flow in Playwright?",
    a: `<p>Install <a href="https://www.npmjs.com/package/playwright-receivemail">playwright-receivemail</a>. Each test gets its own fresh inbox as a <code>mailbox</code> fixture:</p>
<pre>npm i -D playwright-receivemail</pre>
<pre>import { test, expect } from "playwright-receivemail";

test("a new user can verify their email", async ({ page, mailbox }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(mailbox.address);
  await page.getByRole("button", { name: "Create account" }).click();

  const link = await mailbox.waitForMatch(/https:\\/\\/[^\\s"]+\\/verify[^\\s"]*/, {
    subjectContains: "verify",
    timeout: 30_000,
  });
  await page.goto(link);
  await expect(page.getByText("Email verified")).toBeVisible();
});</pre>`,
    text: "Install playwright-receivemail (npm i -D playwright-receivemail). Each test gets a fresh inbox as a mailbox fixture: fill mailbox.address into your signup form, then await mailbox.waitForMatch(/verify-link regex/) to get the link from the email and open it.",
  },
  {
    q: "How do I test an email verification flow in Cypress?",
    a: `<p>Install <a href="https://www.npmjs.com/package/cypress-receivemail">cypress-receivemail</a> and register its commands in your support file:</p>
<pre>npm i -D cypress-receivemail</pre>
<pre>import { addReceivemailCommands } from "cypress-receivemail";
addReceivemailCommands();

cy.createMailbox().then((mb) =&gt; {
  cy.visit("/signup");
  cy.get("input[name=email]").type(mb.address);
  cy.contains("button", "Create account").click();
  cy.getEmailMatch(/\\b\\d{6}\\b/).then((code) =&gt; cy.get("input[name=code]").type(code));
});</pre>`,
    text: "Install cypress-receivemail and call addReceivemailCommands() in your support file. Then cy.createMailbox() gives a fresh address, and cy.getEmailMatch(regex) waits for the email and returns the match (a code or a link).",
  },
  {
    q: "How do I use it without a library, from curl or any language?",
    a: `<p>Two HTTP calls. Create a mailbox:</p>
<pre>curl -X POST https://receivemail.dev/mailboxes \\
  -H 'content-type: application/json' -d '{"ttlMinutes": 15}'
<span class="comment"># =&gt; {"address":"a1b2c3d4e5f6@receivemail.dev","expiresAt":"...","secret":"..."}</span></pre>
<p>Send your app's email to <code>address</code>, then read it with the <code>secret</code>:</p>
<pre>curl https://receivemail.dev/mailboxes/a1b2c3d4e5f6@receivemail.dev/messages \\
  -H 'authorization: Bearer &lt;secret&gt;'
<span class="comment"># =&gt; {"address":"...","messages":[{"from_address":"...","subject":"...","body_text":"...","received_at":"2026-09-26T04:54:46Z"}]}</span></pre>
<p>Poll every few seconds until the message you expect shows up, or call <code>GET /mailboxes/:address/wait?timeout=25</code> with the same header: it holds the request open and returns as soon as a message arrives (<code>{"timed_out":true}</code> if none does). Messages are newest first; <code>received_at</code> is ISO 8601 in UTC.</p>`,
    text: "POST https://receivemail.dev/mailboxes (optional JSON {\"ttlMinutes\": 15}) returns {address, expiresAt, secret}. Send your email to the address, then GET https://receivemail.dev/mailboxes/{address}/messages with the header Authorization: Bearer {secret}; it returns {address, messages:[{from_address, subject, body_text, received_at}]}, newest first, received_at in ISO 8601 UTC. Poll every few seconds.",
  },
  {
    q: "How do I pull a 6-digit code or a verification link out of the email?",
    a: `<p>Match against <code>body_text</code> (or <code>subject</code>). Typical patterns:</p>
<pre>const code = body_text.match(/\\b\\d{6}\\b/)?.[0];
const link = body_text.match(/https:\\/\\/[^\\s"]+\\/verify[^\\s"]*/)?.[0];</pre>
<p>The Playwright and Cypress helpers do this for you: pass the regex to <code>waitForMatch</code> / <code>getEmailMatch</code>.</p>`,
    text: "Run a regex over body_text (or subject), e.g. /\\b\\d{6}\\b/ for a 6-digit code or /https:\\/\\/[^\\s\"]+\\/verify[^\\s\"]*/ for a link. The Playwright and Cypress helpers accept the regex directly.",
  },
  {
    q: "How long does an address live, and how long is mail kept?",
    a: `<p>You choose the address lifetime with <code>ttlMinutes</code>: 1 to 60 minutes, 15 by default. Received mail is deleted after about 24 hours. Use a new address per test run rather than reusing one.</p>`,
    text: "An address lives 1 to 60 minutes (ttlMinutes, default 15). Received mail is deleted after about 24 hours. Use a new address per test run.",
  },
  {
    q: "What are the limits?",
    a: `<ul>
<li>20 new mailboxes per minute per IP address, and 5,000 per day across the service.</li>
<li>The last 50 messages per address are returned.</li>
<li>Plain-text body only: no HTML body and no attachments.</li>
</ul>`,
    text: "20 new mailboxes per minute per IP and 5,000 per day across the service; the last 50 messages per address; plain-text body only, with no HTML body and no attachments.",
  },
  {
    q: "Can someone else read my test emails?",
    a: `<p>Reading a mailbox needs the <code>secret</code> returned when it was created, and addresses are random. Mail sent to an address nobody reserved can't be read through the API. Still, treat these inboxes as throwaway test infrastructure: don't send real users' personal data to them.</p>`,
    text: "Reading a mailbox requires the secret returned when it was created, and addresses are random; mail to an unreserved address can't be read through the API. Treat these inboxes as throwaway test infrastructure and don't send real personal data to them.",
  },
  {
    q: "Can an AI agent use it?",
    a: `<p>Yes. The <a href="https://www.npmjs.com/package/agent-identity-mcp">agent-identity-mcp</a> MCP server gives an agent (Claude, Cursor and others) a disposable receivemail.dev inbox for free, plus a real UK phone number for SMS codes through <a href="https://flo-voice1.com">sms-florin</a> (paid). There is also an <a href="https://www.npmjs.com/package/n8n-nodes-receivemail">n8n node</a>.</p>`,
    text: "Yes. The agent-identity-mcp MCP server gives an AI agent a disposable receivemail.dev inbox for free, plus a real UK phone number for SMS codes via sms-florin (paid). There is also an n8n node, n8n-nodes-receivemail.",
  },
  {
    q: "Is it really free, and what are the alternatives?",
    a: `<p>Yes, within the limits above. If you need HTML bodies, attachments, custom domains or long-lived inboxes, a paid service such as Mailosaur or MailSlurp fits better; see our comparisons with <a href="/compare/mailosaur-alternative">Mailosaur</a>, <a href="/compare/mailslurp-alternative">MailSlurp</a> and <a href="/compare/mailinator-alternative">Mailinator</a>.</p>`,
    text: "Yes, within the limits above. For HTML bodies, attachments, custom domains or long-lived inboxes, paid services such as Mailosaur or MailSlurp fit better.",
  },
];

const TITLE = "receivemail.dev FAQ: testing email verification in Playwright, Cypress and CI";
const DESCRIPTION =
  "How to receive and read real verification emails in automated tests: Playwright and Cypress helpers, a plain HTTP API, limits, retention and privacy.";

const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.text },
  })),
}).replace(/</g, "\\u003c");

export const FAQ_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon.png">
<meta name="description" content="${DESCRIPTION}">
<link rel="canonical" href="https://receivemail.dev/faq">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:url" content="https://receivemail.dev/faq">
<script type="application/ld+json">${jsonLd}</script>
<style>${SHARED_STYLE}</style>
</head>
<body>
<div class="wrap">
  <div class="logo"><a href="/">receivemail.dev</a> / faq</div>
  <h1>Frequently asked questions</h1>
  <p class="meta">${DESCRIPTION}</p>
  ${FAQ.map((f) => `<h2>${f.q}</h2>\n${f.a}`).join("\n")}
  <footer><a href="/">receivemail.dev</a> · <a href="/guides/testing-verification-emails">Testing verification emails in CI</a> · <a href="/llms.txt">llms.txt</a></footer>
</div>
</body>
</html>`;
