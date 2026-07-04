"use client";

import { useEffect, useRef, useState } from "react";

interface ApiGraph {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<Record<string, unknown>>;
  totalNodes: number;
  customerNodes: number;
}

const TYPE_COLORS: Record<string, string> = {
  Entity: "#4f46e5",
  EntityType: "#818cf8",
  TextSummary: "#f59e0b",
  DocumentChunk: "#94a3b8",
  TextDocument: "#64748b",
  NodeSet: "#10b981",
};

export default function CustomerGraph({
  slug,
  customerId,
}: {
  slug: string;
  customerId: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [counts, setCounts] = useState<{ nodes: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cy: { destroy: () => void } | null = null;

    (async () => {
      try {
        const res = await fetch(`/api/companies/${slug}/customers/${customerId}/graph`);
        if (!res.ok) throw new Error("graph fetch failed");
        const graph: ApiGraph = await res.json();
        if (cancelled) return;
        setCounts({ nodes: graph.customerNodes, total: graph.totalNodes });
        if (!graph.nodes.length) {
          setState("empty");
          return;
        }
        const { default: cytoscape } = await import("cytoscape");
        if (cancelled || !containerRef.current) return;

        const seen = new Set(graph.nodes.map((n) => n.id));
        cy = cytoscape({
          container: containerRef.current,
          elements: [
            ...graph.nodes.map((n) => ({
              data: {
                id: n.id,
                label:
                  (n.label ?? n.type ?? "node").length > 28
                    ? `${n.label.slice(0, 28)}...`
                    : (n.label ?? n.type ?? "node"),
                color: TYPE_COLORS[n.type] ?? "#a5b4fc",
                size: n.label?.toLowerCase().includes(customerId.toLowerCase()) ? 34 : 20,
              },
            })),
            ...graph.edges
              .map((e, i) => {
                const source = String(e.source ?? e.from ?? e.source_node_id ?? "");
                const target = String(e.target ?? e.to ?? e.target_node_id ?? "");
                return { data: { id: `e${i}`, source, target } };
              })
              .filter((e) => seen.has(e.data.source) && seen.has(e.data.target)),
          ],
          style: [
            {
              selector: "node",
              style: {
                "background-color": "data(color)",
                label: "data(label)",
                width: "data(size)",
                height: "data(size)",
                "font-size": "9px",
                color: "#334155",
                "text-valign": "bottom",
                "text-margin-y": 4,
                "text-wrap": "ellipsis",
                "text-max-width": "120px",
              },
            },
            {
              selector: "edge",
              style: {
                width: 1,
                "line-color": "#cbd5e1",
                "curve-style": "bezier",
                "target-arrow-shape": "triangle",
                "target-arrow-color": "#cbd5e1",
                "arrow-scale": 0.7,
              },
            },
          ],
          layout: { name: "cose", animate: false, padding: 24 },
          wheelSensitivity: 0.2,
        });
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      cy?.destroy();
    };
  }, [slug, customerId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">What the agent knows</h3>
        {counts ? (
          <span className="text-xs text-slate-400">
            {counts.nodes} of {counts.total} memory nodes
          </span>
        ) : null}
      </div>
      {state === "loading" ? (
        <p className="py-16 text-center text-sm text-slate-400">Loading memory graph...</p>
      ) : state === "empty" ? (
        <p className="py-16 text-center text-sm text-slate-400">
          No memories for this customer yet - or they have been forgotten.
        </p>
      ) : state === "error" ? (
        <p className="py-16 text-center text-sm text-red-500">Could not load the graph.</p>
      ) : null}
      <div
        ref={containerRef}
        className={state === "ready" ? "h-[420px] w-full" : "h-0 w-full"}
      />
    </div>
  );
}
