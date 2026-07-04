import Link from "next/link";
import MemoryConstellation from "@/components/landing/MemoryConstellation";
import CodeTabs from "@/components/landing/CodeTabs";

// Real events from a verified live session (2026-07-04), not mockups.
const FEED_LINES = [
  ["RECALL", "recall for cust_2b88ecea - I keep hitting error ZEN-42, help? (7578ms)"],
  ["REMEMBER", "remember cust_2b88ecea - QA turn stored in memory graph"],
  ["RECALL", "recall for cust_2b88ecea - Have we spoken before? What was my issue? (9298ms)"],
  ["RESOLVE", "resolution learned - Widget bluetooth pairing fails on Linux"],
  ["RECALL", "recall for cust_200db187 - bluetooth pairing fails on my Linux machine, any fix?"],
  ["REMEMBER", "remember cust_200db187 - QA turn stored in memory graph"],
  ["FORGET", "forgot cust_2b88ecea - 4 memory items hard-deleted from the graph"],
];

const FEED_COLORS: Record<string, string> = {
  RECALL: "text-sky-400",
  REMEMBER: "text-emerald-400",
  RESOLVE: "text-amber-400",
  FORGET: "text-red-400",
};

function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-indigo-400">
        {eyebrow}
      </p>
      <h2 className="font-display mt-3 text-4xl text-slate-100 sm:text-5xl">{title}</h2>
      {sub ? <p className="mt-4 text-base leading-relaxed text-slate-400">{sub}</p> : null}
    </div>
  );
}

function FeatureCard({
  title,
  body,
  tag,
  className = "",
}: {
  title: string;
  body: string;
  tag: string;
  className?: string;
}) {
  return (
    <div
      className={`group rounded-2xl border border-indigo-500/15 bg-gradient-to-b from-[#0d0d18] to-[#090911] p-6 transition-colors hover:border-indigo-400/40 ${className}`}
    >
      <p className="font-mono text-[11px] uppercase tracking-widest text-indigo-400/80">
        {tag}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}

function ArchBox({ label, sub, accent }: { label: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-center ${
        accent
          ? "border-indigo-400/50 bg-indigo-500/10 text-indigo-200"
          : "border-slate-700 bg-[#0d0d18] text-slate-300"
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
      {sub ? <p className="mt-0.5 font-mono text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

const FAQS = [
  {
    q: "Where does the memory actually live?",
    a: "In Cognee Cloud knowledge graphs. Each company gets two isolated graph databases: one for its knowledge base, one for customer memory. Every conversation turn becomes graph entities and relationships, not just embeddings.",
  },
  {
    q: "Do I need my own OpenAI or Anthropic key?",
    a: "No. Answers are generated server-side by the memory layer from your graph context. You bring documentation, not API keys.",
  },
  {
    q: "How does 'forget me' work?",
    a: "Every memory written for a customer is a tracked data item. Forgetting hard-deletes those items from the graph and vector store, and you can verify it: the customer's memory graph visibly drops to zero nodes.",
  },
  {
    q: "Can I use the agent outside my website?",
    a: "Yes. The widget is one integration; the same agent is exposed as a REST API you can call from your product, mobile app, Slack bot, or backend. See the docs for the full reference.",
  },
  {
    q: "What do you train on?",
    a: "Only what you provide: pasted text, page URLs, or uploaded files. No repo access, no crawling you did not ask for.",
  },
  {
    q: "How does it get smarter over time?",
    a: "When your team marks a conversation resolved, the verified solution is written into the knowledge graph and becomes a playbook. The next customer with the same problem gets the answer immediately.",
  },
];

export default function LandingPage() {
  return (
    <div className="landing min-h-dvh bg-[#07070d] text-slate-300">
      {/* nav */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#07070d]/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            Ever<span className="text-indigo-400">Desk</span>
          </Link>
          <div className="ml-auto flex items-center gap-6 text-sm">
            <Link href="/docs" className="text-slate-400 hover:text-white">
              Docs
            </Link>
            <a href="#integrate" className="hidden text-slate-400 hover:text-white sm:block">
              Integrate
            </a>
            <a href="#pricing" className="hidden text-slate-400 hover:text-white sm:block">
              Pricing
            </a>
            <Link
              href="/onboarding"
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.35)] hover:bg-indigo-400"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="ed-glow pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[860px] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            <p className="ed-rise font-mono text-xs uppercase tracking-[0.3em] text-indigo-400">
              Customer support agents as a service
            </p>
            <h1
              className="ed-rise font-display mt-5 text-5xl leading-[1.05] text-white sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "0.1s" }}
            >
              A support agent that{" "}
              <em className="text-indigo-300">never forgets</em> a customer
            </h1>
            <p
              className="ed-rise mt-6 max-w-xl text-lg leading-relaxed text-slate-400"
              style={{ animationDelay: "0.2s" }}
            >
              Train it on your docs in minutes. Embed it with one line. It
              greets returning customers with their history, learns from every
              resolved ticket, and can provably forget anyone who asks.
            </p>
            <div className="ed-rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "0.3s" }}>
              <Link
                href="/onboarding"
                className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_32px_rgba(99,102,241,0.4)] hover:bg-indigo-400"
              >
                Onboard your company
              </Link>
              <Link
                href="/docs"
                className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500"
              >
                Read the docs
              </Link>
            </div>
            <p
              className="ed-rise mt-6 font-mono text-xs text-slate-600"
              style={{ animationDelay: "0.4s" }}
            >
              Memory by Cognee Cloud knowledge graphs
            </p>
          </div>
          <div className="ed-rise relative h-[340px] lg:h-[420px]" style={{ animationDelay: "0.25s" }}>
            <MemoryConstellation />
          </div>
        </div>

        {/* stats strip */}
        <div className="border-y border-white/5">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-white/5 px-6 md:grid-cols-4">
            {[
              ["1 line", "to install the widget"],
              ["0 keys", "no LLM keys to manage"],
              ["2 graphs", "knowledge + customer memory"],
              ["100%", "provable right-to-forget"],
            ].map(([big, small]) => (
              <div key={big} className="px-6 py-6 text-center">
                <p className="font-mono text-2xl font-semibold text-white">{big}</p>
                <p className="mt-1 text-xs text-slate-500">{small}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* editorial */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="font-display text-4xl leading-snug text-slate-200 sm:text-5xl">
          Support bots answer the ticket.{" "}
          <span className="text-slate-500">Then forget the customer.</span>
          <br />
          <span className="mt-4 inline-block bg-indigo-500 px-3 py-1 text-white">
            Your customers remember. Now your support does too.
          </span>
        </p>
        <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-slate-400">
          Every support bot on the market is stateless retrieval over docs. The
          customer who wrote in three weeks ago is a stranger again today.
          EverDesk gives your agent a permanent, queryable memory of every
          customer relationship.
        </p>
      </section>

      {/* bento features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <SectionHeading
          eyebrow="What it does"
          title="Memory, not just retrieval"
          sub="Five things a stateless bot cannot do, out of the box."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <FeatureCard
            tag="recall"
            title="Recognizes returning customers"
            body="A customer comes back days later, in a fresh session, and the agent picks up where you left off: 'Yes, we spoke on July 4 about error ZEN-42.'"
            className="md:col-span-2"
          />
          <FeatureCard
            tag="improve"
            title="Learns from every resolution"
            body="Mark a ticket resolved and the verified fix joins the knowledge graph. The next customer with that problem gets the answer in seconds."
          />
          <FeatureCard
            tag="forget"
            title="Right to be forgotten, provable"
            body="One click hard-deletes a customer's memories from graph and vector store. Their memory graph visibly drops to zero nodes."
          />
          <FeatureCard
            tag="graph"
            title="A knowledge graph, not a doc dump"
            body="Your docs become entities and relationships. Customers become nodes linked to their issues, plans, and resolutions - and you can see it."
          />
          <FeatureCard
            tag="ops"
            title="Ops built in"
            body="Every conversation is a session with transcript, tokens, cost, and feedback. A live memory feed shows each recall and remember as it happens."
          />
        </div>
      </section>

      {/* live feed strip */}
      <section className="border-y border-white/5 bg-[#090911] py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="Judge view"
            title="Watch it think"
            sub="From a real session on 2026-07-04: one customer's issue becomes another customer's instant answer, then gets forgotten on request."
          />
          <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-2xl border border-indigo-500/20 bg-black">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <p className="font-mono text-xs text-slate-500">cognee memory ops</p>
            </div>
            <div className="h-56 overflow-hidden p-4">
              <div className="ed-feed-scroll space-y-1.5">
                {[...FEED_LINES, ...FEED_LINES].map(([type, line], i) => (
                  <p key={i} className="font-mono text-xs leading-relaxed">
                    <span className={`font-semibold ${FEED_COLORS[type]}`}>{type}</span>
                    <span className="text-slate-400"> {line}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* architecture */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="Core architecture"
          title="Two graphs per company"
          sub="Everything your agent knows lives in isolated knowledge graphs on Cognee Cloud."
        />
        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ArchBox label="Website widget" sub="embed.js" />
            <ArchBox label="Your product" sub="REST API" />
          </div>
          <div className="text-center font-mono text-xs text-slate-600">v</div>
          <ArchBox label="EverDesk agent" sub="recall -> answer -> remember" accent />
          <div className="text-center font-mono text-xs text-slate-600">v</div>
          <div className="grid grid-cols-2 gap-3">
            <ArchBox label="Knowledge graph" sub="docs + learned resolutions" />
            <ArchBox label="Customer memory graph" sub="every customer, every issue" />
          </div>
          <div className="text-center font-mono text-xs text-slate-600">v</div>
          <ArchBox label="Cognee Cloud" sub="graph + vector, isolated per dataset" />
        </div>
      </section>

      {/* comparison */}
      <section className="border-y border-white/5 bg-[#090911] py-24">
        <div className="mx-auto max-w-4xl px-6">
          <SectionHeading eyebrow="The difference" title="Stateless bot vs EverDesk" />
          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="py-3 pr-4 font-medium text-slate-500"></th>
                  <th className="py-3 pr-4 font-medium text-slate-500">Stateless support bot</th>
                  <th className="py-3 font-medium text-indigo-300">EverDesk</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                {[
                  ["Returning customer", "A stranger every time", "Greeted with full history"],
                  ["Resolved tickets", "Knowledge lost in logs", "Learned by the agent, reused forever"],
                  ["Delete my data", "Good luck with the logs", "Provable graph deletion"],
                  ["Understanding", "Embedding similarity", "Entities and relationships"],
                  ["Setup", "Weeks of integration", "Docs in, script tag out - minutes"],
                ].map(([row, bad, good]) => (
                  <tr key={row} className="border-b border-white/5">
                    <td className="py-4 pr-4 font-medium text-slate-300">{row}</td>
                    <td className="py-4 pr-4">{bad}</td>
                    <td className="py-4 text-indigo-200">{good}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* integrate */}
      <section id="integrate" className="mx-auto max-w-4xl px-6 py-24">
        <SectionHeading
          eyebrow="Integrate"
          title="Plug it into anything"
          sub="A widget for your site, an API for your product. Same agent, same memory."
        />
        <div className="mt-12">
          <CodeTabs />
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="border-t border-white/5 bg-[#090911] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <SectionHeading
            eyebrow="Pricing"
            title="Early access plans"
            sub="Usage-based memory, priced simply while we are in preview."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                name: "Sandbox",
                price: "Free",
                blurb: "Kick the tires",
                items: ["1 company", "Widget + API", "Full memory features", "Community support"],
                featured: false,
              },
              {
                name: "Growth",
                price: "$99/mo",
                blurb: "For live products",
                items: ["3 companies", "Priority pipelines", "Ops dashboard", "Email support"],
                featured: true,
              },
              {
                name: "Scale",
                price: "Custom",
                blurb: "Serious volume",
                items: ["Unlimited companies", "Dedicated tenancy", "SLA", "Founder on call"],
                featured: false,
              },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl border p-6 ${
                  tier.featured
                    ? "border-indigo-400/50 bg-indigo-500/10 shadow-[0_0_48px_rgba(99,102,241,0.15)]"
                    : "border-white/10 bg-[#0d0d18]"
                }`}
              >
                <p className="text-sm font-semibold text-slate-200">{tier.name}</p>
                <p className="mt-3 font-mono text-3xl font-semibold text-white">{tier.price}</p>
                <p className="mt-1 text-xs text-slate-500">{tier.blurb}</p>
                <ul className="mt-5 space-y-2 text-sm text-slate-400">
                  {tier.items.map((it) => (
                    <li key={it} className="flex gap-2">
                      <span className="text-indigo-400">+</span>
                      {it}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/onboarding"
                  className={`mt-6 block rounded-lg py-2 text-center text-sm font-semibold ${
                    tier.featured
                      ? "bg-indigo-500 text-white hover:bg-indigo-400"
                      : "border border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  Start now
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* faq */}
      <section className="mx-auto max-w-3xl px-6 py-24">
        <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-10 divide-y divide-white/5 border-y border-white/5">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-200">
                {f.q}
                <span className="ml-4 font-mono text-indigo-400 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* final cta */}
      <section className="relative overflow-hidden border-t border-white/5 py-24 text-center">
        <div className="ed-glow pointer-events-none absolute bottom-0 left-1/2 h-[400px] w-[700px] -translate-x-1/2 translate-y-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
        <h2 className="font-display mx-auto max-w-2xl px-6 text-5xl text-white">
          Give your support a memory
        </h2>
        <p className="mt-4 text-slate-400">Docs to deployed agent in minutes.</p>
        <Link
          href="/onboarding"
          className="mt-8 inline-block rounded-xl bg-indigo-500 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_0_40px_rgba(99,102,241,0.45)] hover:bg-indigo-400"
        >
          Onboard your company
        </Link>
      </section>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 text-xs text-slate-600">
          <p className="font-semibold text-slate-400">
            Ever<span className="text-indigo-400">Desk</span>
          </p>
          <p>Support that never forgets. Memory by Cognee Cloud.</p>
          <div className="ml-auto flex gap-5">
            <Link href="/docs" className="hover:text-slate-300">
              Docs
            </Link>
            <a href="https://github.com/Allen-Saji/everdesk" className="hover:text-slate-300">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
