"use client";

import { useEffect, useState } from "react";
import type { OpsEvent } from "@/lib/events";

const TYPE_STYLES: Record<string, string> = {
  recall: "text-sky-400",
  remember: "text-emerald-400",
  resolve: "text-amber-400",
  forget: "text-red-400",
  train: "text-violet-400",
  provision: "text-indigo-400",
  action: "text-fuchsia-400",
};

export default function MemoryFeed({ slug }: { slug: string }) {
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [live, setLive] = useState(true);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/events?slug=${slug}&limit=100`);
        if (res.ok && active) {
          const data = await res.json();
          setEvents(data.events ?? []);
          setLive(true);
        }
      } catch {
        if (active) setLive(false);
      }
    };
    tick();
    const interval = setInterval(tick, 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [slug]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2.5">
        <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-red-400"}`} />
        <p className="font-mono text-xs text-slate-400">
          cognee memory ops - {slug} - polling 1.5s
        </p>
      </div>
      <div className="h-[560px] overflow-y-auto p-4 font-mono text-xs leading-relaxed">
        {events.length === 0 ? (
          <p className="text-slate-600">waiting for memory activity...</p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex gap-3 py-0.5">
              <span className="shrink-0 text-slate-600">
                {new Date(e.ts).toLocaleTimeString()}
              </span>
              <span className={`w-20 shrink-0 font-semibold ${TYPE_STYLES[e.type] ?? "text-slate-300"}`}>
                {e.type.toUpperCase()}
              </span>
              <span className="text-slate-300">
                {e.label}
                {e.detail ? <span className="text-slate-500"> - {e.detail}</span> : null}
                {typeof e.latencyMs === "number" ? (
                  <span className="text-slate-600"> ({e.latencyMs}ms)</span>
                ) : null}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
