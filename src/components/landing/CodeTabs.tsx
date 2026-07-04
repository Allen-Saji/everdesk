"use client";

import { useState } from "react";

const TABS = [
  {
    id: "widget",
    label: "Website widget",
    caption: "One script tag before </body>. That is the whole install.",
    code: `<script
  src="https://everdesk.allensaji.dev/embed.js"
  data-everdesk-key="pk_yourcompany_xxxxxxxx"
  async>
</script>`,
  },
  {
    id: "rest",
    label: "REST API",
    caption: "The same agent inside your product, app, or backend.",
    code: `curl -X POST https://everdesk.allensaji.dev/api/v1/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "key": "pk_yourcompany_xxxxxxxx",
    "visitorId": "user-123",
    "email": "customer@example.com",
    "message": "How do refunds work?"
  }'

# -> { "answer": "...", "sessionId": "...", "customerId": "cust_..." }`,
  },
  {
    id: "react",
    label: "React",
    caption: "Drop the agent into any React app.",
    code: `export function SupportChat() {
  return (
    <iframe
      src="https://everdesk.allensaji.dev/widget?key=pk_yourcompany_xxxxxxxx"
      style={{ width: 380, height: 600, border: 0, borderRadius: 16 }}
      title="Support chat"
    />
  );
}`,
  },
];

export default function CodeTabs() {
  const [active, setActive] = useState(TABS[0]);
  const [copied, setCopied] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-500/20 bg-[#0b0b14]">
      <div className="flex items-center gap-1 border-b border-indigo-500/15 px-3 pt-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t)}
            className={`rounded-t-lg px-4 py-2 text-xs font-medium transition-colors ${
              active.id === t.id
                ? "bg-indigo-500/10 text-indigo-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => {
            navigator.clipboard.writeText(active.code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="ml-auto mb-1 rounded-md border border-indigo-500/25 px-2.5 py-1 text-[11px] text-indigo-300 hover:bg-indigo-500/10"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-slate-300">
        <code>{active.code}</code>
      </pre>
      <p className="border-t border-indigo-500/10 px-5 py-3 text-xs text-slate-500">
        {active.caption}
      </p>
    </div>
  );
}
