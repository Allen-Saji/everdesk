"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResolveForm({
  slug,
  defaultProblem,
  defaultSolution,
}: {
  slug: string;
  defaultProblem: string;
  defaultSolution: string;
}) {
  const router = useRouter();
  const [problem, setProblem] = useState(defaultProblem);
  const [solution, setSolution] = useState(defaultSolution);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  const submit = async () => {
    setState("saving");
    const res = await fetch(`/api/companies/${slug}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem, solution }),
    });
    if (res.ok) {
      setState("done");
      router.refresh();
    } else {
      setState("error");
    }
  };

  return state === "done" ? (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
      Resolution learned. The next customer with this problem gets the answer
      instantly - watch the memory feed.
    </div>
  ) : (
    <div className="rounded-xl border border-white/10 bg-[#0d0d18] p-5">
      <h3 className="text-sm font-semibold">Mark resolved and teach the agent</h3>
      <p className="mt-1 text-xs text-slate-400">
        The resolution is written into the knowledge graph so every future
        customer benefits.
      </p>
      <label className="mt-4 block text-xs font-medium text-slate-300">Problem</label>
      <textarea
        value={problem}
        onChange={(e) => setProblem(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-lg border border-white/10 p-2.5 text-sm bg-white/5 text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-400"
      />
      <label className="mt-3 block text-xs font-medium text-slate-300">Solution</label>
      <textarea
        value={solution}
        onChange={(e) => setSolution(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-lg border border-white/10 p-2.5 text-sm bg-white/5 text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-400"
      />
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={state === "saving" || !problem.trim() || !solution.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {state === "saving" ? "Teaching agent..." : "Mark resolved"}
        </button>
        {state === "error" ? (
          <p className="text-sm text-red-400">Failed - try again.</p>
        ) : null}
      </div>
    </div>
  );
}
