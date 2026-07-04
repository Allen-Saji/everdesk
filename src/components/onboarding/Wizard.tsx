"use client";

import { useState } from "react";
import Link from "next/link";

type StepState = "pending" | "active" | "done" | "error";

interface ProvisionStep {
  label: string;
  state: StepState;
}

const INITIAL_STEPS: ProvisionStep[] = [
  { label: "Creating knowledge graph", state: "pending" },
  { label: "Creating customer memory graph", state: "pending" },
  { label: "Registering support agent", state: "pending" },
  { label: "Ingesting your documentation", state: "pending" },
  { label: "Building the knowledge graph", state: "pending" },
];

export default function Wizard() {
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [docsText, setDocsText] = useState("");
  const [docsUrls, setDocsUrls] = useState("");
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<{ slug: string; publicKey: string } | null>(null);

  const setStep = (i: number, state: StepState) =>
    setSteps((s) => s.map((st, j) => (j === i ? { ...st, state } : st)));

  const canStart = name.trim().length >= 2 && (docsText.trim() || docsUrls.trim());

  const run = async () => {
    setPhase(2);
    setError(null);
    setSteps(INITIAL_STEPS.map((s, i) => ({ ...s, state: i === 0 ? "active" : "pending" })));
    try {
      // provision (datasets + agent + record). Steps 0-2 map to this call.
      setStep(1, "active");
      setStep(2, "active");
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), siteUrl: siteUrl.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "provisioning failed");
      setCompany({ slug: data.company.slug, publicKey: data.company.publicKey });
      setStep(0, "done");
      setStep(1, "done");
      setStep(2, "done");

      // train
      setStep(3, "active");
      const body = {
        texts: docsText.trim() ? [docsText.trim()] : [],
        urls: docsUrls
          .split("\n")
          .map((u) => u.trim())
          .filter(Boolean),
      };
      const trainRes = await fetch(`/api/companies/${data.company.slug}/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!trainRes.ok) throw new Error("training failed");
      setStep(3, "done");

      // cognify poll
      setStep(4, "active");
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const s = await fetch(`/api/companies/${data.company.slug}/train`).then((r) =>
          r.json(),
        );
        if (s.errored) throw new Error("knowledge graph build failed");
        if (!s.training && s.kb === "DATASET_PROCESSING_COMPLETED") break;
      }
      setStep(4, "done");
      setPhase(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSteps((s) => s.map((st) => (st.state === "active" ? { ...st, state: "error" } : st)));
    }
  };

  const input =
    "w-full rounded-xl border border-slate-700 bg-[#0d0d18] px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-400";

  if (phase === 1) {
    return (
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">
            Company name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Cloud"
            className={input}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">
            Website (optional)
          </label>
          <input
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://acme.cloud"
            className={input}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">
            Paste your docs
          </label>
          <textarea
            value={docsText}
            onChange={(e) => setDocsText(e.target.value)}
            rows={7}
            placeholder="Product guide, FAQs, policies - whatever your customers ask about..."
            className={input}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">
            Or add documentation URLs (one per line)
          </label>
          <textarea
            value={docsUrls}
            onChange={(e) => setDocsUrls(e.target.value)}
            rows={3}
            placeholder={"https://acme.cloud/docs\nhttps://acme.cloud/faq"}
            className={`${input} font-mono text-xs`}
          />
        </div>
        <button
          onClick={run}
          disabled={!canStart}
          className="w-full rounded-xl bg-indigo-500 py-3.5 text-sm font-semibold text-white shadow-[0_0_32px_rgba(99,102,241,0.35)] hover:bg-indigo-400 disabled:opacity-40"
        >
          Provision my support agent
        </button>
      </div>
    );
  }

  if (phase === 2) {
    return (
      <div className="space-y-3">
        {steps.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#0d0d18] px-4 py-3.5"
          >
            {s.state === "done" ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-400">
                +
              </span>
            ) : s.state === "active" ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            ) : s.state === "error" ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-xs text-red-400">
                x
              </span>
            ) : (
              <span className="h-5 w-5 rounded-full border border-slate-700" />
            )}
            <p
              className={`text-sm ${
                s.state === "done"
                  ? "text-slate-300"
                  : s.state === "active"
                    ? "text-white"
                    : "text-slate-500"
              }`}
            >
              {s.label}
            </p>
          </div>
        ))}
        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
            <button onClick={() => setPhase(1)} className="ml-3 underline">
              Back
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const snippet = `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/embed.js" data-everdesk-key="${company?.publicKey}" async></script>`;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <p className="text-sm font-semibold text-emerald-300">
          Your support agent is live and trained.
        </p>
        <p className="mt-1 text-xs text-emerald-400/70">
          It already knows your docs - and it will remember every customer it meets.
        </p>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-slate-400">
          Add this to your site, before the closing body tag:
        </p>
        <pre className="overflow-x-auto rounded-xl border border-indigo-500/20 bg-black p-4 font-mono text-xs leading-relaxed text-slate-300">
          {snippet}
        </pre>
        <button
          onClick={() => navigator.clipboard.writeText(snippet)}
          className="mt-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
        >
          Copy snippet
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/dashboard/${company?.slug}`}
          className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          Open dashboard
        </Link>
        <Link
          href={`/dashboard/${company?.slug}/playground`}
          className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500"
        >
          Talk to your agent
        </Link>
      </div>
    </div>
  );
}
