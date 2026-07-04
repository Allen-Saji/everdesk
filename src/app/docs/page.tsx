import Link from "next/link";

export const metadata = { title: "Docs - EverDesk" };

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-indigo-500/15 bg-black p-4 font-mono text-[13px] leading-relaxed text-slate-300">
      <code>{children}</code>
    </pre>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-display mt-14 scroll-mt-24 text-3xl text-white">
      {children}
    </h2>
  );
}

const SECTIONS = [
  ["quickstart", "Quickstart"],
  ["widget", "Website widget"],
  ["rest", "REST API"],
  ["actions", "Actions & webhooks"],
  ["react", "React"],
  ["forget", "Forget API"],
];

export default function DocsPage() {
  return (
    <div className="landing min-h-dvh bg-[#07070d] text-slate-300">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#07070d]/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            Ever<span className="text-indigo-400">Desk</span>
          </Link>
          <span className="text-sm text-slate-500">Docs</span>
          <Link
            href="/onboarding"
            className="ml-auto rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Get started
          </Link>
        </nav>
      </header>

      <div className="mx-auto flex max-w-5xl gap-10 px-6 py-12">
        <aside className="sticky top-24 hidden h-fit w-44 shrink-0 md:block">
          <ul className="space-y-2 text-sm">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-slate-500 hover:text-indigo-300">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <main className="min-w-0 max-w-2xl flex-1 pb-24">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-indigo-400">
            Integration guide
          </p>
          <h1 className="font-display mt-3 text-4xl text-white">
            Plug a remembering agent into anything
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            EverDesk exposes your trained support agent two ways: a drop-in
            website widget and a REST API for your own product surfaces. Both
            share the same memory - a customer who chats on your site is
            recognized in your app.
          </p>

          <H2 id="quickstart">Quickstart</H2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-400">
            <li>
              <Link href="/onboarding" className="text-indigo-300 underline">
                Onboard your company
              </Link>{" "}
              - name it and provide docs (pasted text, URLs, or files). Provisioning
              takes under two minutes.
            </li>
            <li>Copy your public key (looks like pk_yourcompany_xxxxxxxx). It is safe to expose, like an analytics ID.</li>
            <li>Install the widget or call the API - below.</li>
          </ol>

          <H2 id="widget">Website widget</H2>
          <p className="mb-4 mt-3 text-sm leading-relaxed text-slate-400">
            One script tag before the closing body tag. It renders a floating
            chat bubble; the chat itself runs in an isolated iframe, so your
            site styles are never touched.
          </p>
          <Code>{`<script
  src="https://everdesk.allensaji.dev/embed.js"
  data-everdesk-key="pk_yourcompany_xxxxxxxx"
  async>
</script>`}</Code>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Visitors get a persistent identity in their browser; when they share
            an email, memory follows them across devices and sessions.
          </p>

          <H2 id="rest">REST API</H2>
          <p className="mb-4 mt-3 text-sm leading-relaxed text-slate-400">
            The widget uses this same endpoint. Call it from your backend,
            mobile app, in-product help panel, or a Slack bot. CORS is open;
            authenticate with your public key.
          </p>
          <Code>{`POST https://everdesk.allensaji.dev/api/v1/chat
Content-Type: application/json

{
  "key": "pk_yourcompany_xxxxxxxx",   // required
  "visitorId": "user-123",            // required, your stable user id
  "email": "customer@example.com",    // optional, upgrades memory identity
  "sessionId": "everdesk-...",        // optional, returned by first call
  "message": "How do refunds work?"   // required
}`}</Code>
          <p className="mb-4 mt-4 text-sm text-slate-400">Response:</p>
          <Code>{`{
  "answer": "Refunds are processed within 7 days...",
  "grounded": true,
  "sessionId": "everdesk-acme-1a2b3c-1783150000000",
  "customerId": "cust_2b88ecea",
  "latencyMs": 7578
}`}</Code>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-400">
            <li>
              Reuse the returned sessionId for the rest of one conversation; drop
              it to start a new one. Memory persists either way.
            </li>
            <li>
              Keep visitorId stable per user (a database id works). Same
              visitorId means same remembered customer.
            </li>
            <li>grounded is false when the agent could not answer from your knowledge - a good signal to escalate to a human.</li>
          </ul>

          <H2 id="actions">Actions &amp; webhooks</H2>
          <p className="mb-4 mt-3 text-sm leading-relaxed text-slate-400">
            Actions let the agent do things, not just answer: file a ticket,
            ping your team, hit your API. You describe in plain English when an
            action should fire and which fields the agent must collect; when a
            conversation matches, EverDesk POSTs a signed JSON payload to your
            webhook and tells the customer what it did. Every fired action is
            written into that customer&apos;s memory, so next week the agent
            remembers what it already did for them.
          </p>
          <p className="mb-4 text-sm leading-relaxed text-slate-400">
            Configure actions in your dashboard under Actions. Point the URL at
            your own endpoint, or at Zapier / Make / n8n to reach email, Slack,
            CRMs and everything else without writing code. (Slack and Discord
            incoming webhooks expect their own payload shape, so route those
            through one of the automation tools.)
          </p>
          <Code>{`POST <your webhook URL>
Content-Type: application/json
X-Everdesk-Timestamp: 1783150000
X-Everdesk-Signature: sha256=3f5c...9d21

{
  "action": "create_refund_ticket",
  "test": false,
  "company": { "slug": "acme", "name": "Acme" },
  "customer": {
    "customerId": "cust_2b88ecea",
    "email": "customer@example.com"
  },
  "params": { "order_id": "4711" },
  "conversation": {
    "sessionId": "everdesk-acme-1a2b3c-1783150000000",
    "message": "I want a refund for order 4711",
    "answer": "I've filed that refund for you..."
  },
  "firedAt": "2026-07-04T12:00:00.000Z"
}`}</Code>
          <p className="mb-4 mt-4 text-sm leading-relaxed text-slate-400">
            Verify the signature before trusting a payload. The signature is an
            HMAC-SHA256 of <span className="font-mono text-slate-300">timestamp + &quot;.&quot; + rawBody</span>{" "}
            using the signing secret shown once when you created the action.
            Reject requests older than 5 minutes to block replays:
          </p>
          <Code>{`import { createHmac, timingSafeEqual } from "node:crypto";

function verifyEverdesk(rawBody, headers, secret) {
  const ts = headers["x-everdesk-timestamp"];
  const sig = headers["x-everdesk-signature"]; // "sha256=<hex>"
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = "sha256=" + createHmac("sha256", secret)
    .update(ts + "." + rawBody)
    .digest("hex");
  return expected.length === sig.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}`}</Code>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-400">
            <li>
              When an action fires, the chat response gains an{" "}
              <span className="font-mono text-slate-300">
                action: {"{ \"name\", \"status\": \"fired\" }"}
              </span>{" "}
              field and the receipt is appended to the answer.
            </li>
            <li>
              Only https URLs resolving to public addresses are accepted, and
              redirects are never followed.
            </li>
            <li>
              Rate limits apply: 5 fires per customer per hour, 100 per company
              per day, and duplicate fires within 60 seconds are dropped.
            </li>
          </ul>

          <H2 id="react">React</H2>
          <p className="mb-4 mt-3 text-sm leading-relaxed text-slate-400">
            Embed the chat surface directly in any React app:
          </p>
          <Code>{`export function SupportChat() {
  return (
    <iframe
      src="https://everdesk.allensaji.dev/widget?key=pk_yourcompany_xxxxxxxx"
      style={{ width: 380, height: 600, border: 0, borderRadius: 16 }}
      title="Support chat"
    />
  );
}`}</Code>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Or build a fully custom UI on the REST API above - the widget has no
            special powers.
          </p>

          <H2 id="forget">Forget API</H2>
          <p className="mb-4 mt-3 text-sm leading-relaxed text-slate-400">
            Wire right-to-be-forgotten into your own account deletion flow. This
            hard-deletes the customer&apos;s memory items from the graph and vector
            store.
          </p>
          <Code>{`POST https://everdesk.allensaji.dev/api/companies/{slug}/customers/{customerId}/forget

// -> { "status": "forgotten", "deleted": 4 }`}</Code>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Verify it in the dashboard: the customer&apos;s memory graph drops to
            zero nodes.
          </p>

          <div className="mt-16 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6">
            <p className="text-sm font-semibold text-slate-200">Questions?</p>
            <p className="mt-1 text-sm text-slate-400">
              The whole product is open source:{" "}
              <a
                href="https://github.com/Allen-Saji/everdesk"
                className="text-indigo-300 underline"
              >
                github.com/Allen-Saji/everdesk
              </a>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
