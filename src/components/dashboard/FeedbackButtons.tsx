"use client";

import { useState } from "react";

export default function FeedbackButtons({
  slug,
  sessionId,
  qaId,
}: {
  slug: string;
  sessionId: string;
  qaId: string;
}) {
  const [sent, setSent] = useState<"up" | "down" | null>(null);

  const send = async (score: number, dir: "up" | "down") => {
    setSent(dir);
    await fetch(`/api/companies/${slug}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, qaId, score }),
    }).catch(() => setSent(null));
  };

  return sent ? (
    <span className="text-xs text-slate-500">feedback sent ({sent})</span>
  ) : (
    <span className="inline-flex gap-1">
      <button
        onClick={() => send(5, "up")}
        aria-label="Helpful"
        className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-400"
      >
        +1
      </button>
      <button
        onClick={() => send(1, "down")}
        aria-label="Not helpful"
        className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-red-500/10 hover:text-red-400"
      >
        -1
      </button>
    </span>
  );
}
