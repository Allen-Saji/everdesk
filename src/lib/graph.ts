// Customer-scoped subgraph extraction from a Cognee dataset graph.

import { GraphEdge, GraphNode } from "./cognee";

export interface Subgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function edgeEnds(e: GraphEdge): [string, string] | null {
  const s = (e.source ?? e.from ?? e.source_node_id) as string | undefined;
  const t = (e.target ?? e.to ?? e.target_node_id) as string | undefined;
  return s && t ? [s, t] : null;
}

function mentionsCustomer(n: GraphNode, customerId: string): boolean {
  const needle = customerId.toLowerCase();
  if (n.label?.toLowerCase().includes(needle)) return true;
  const props = JSON.stringify(n.properties ?? {}).toLowerCase();
  return props.includes(needle);
}

/**
 * Seed = nodes mentioning the customer id; expand `hops` steps along edges so
 * the issues/products/resolutions linked to the customer come along.
 */
export function customerSubgraph(
  graph: Subgraph,
  customerId: string,
  hops = 2,
): Subgraph {
  const seeds = new Set(
    graph.nodes.filter((n) => mentionsCustomer(n, customerId)).map((n) => n.id),
  );
  if (!seeds.size) return { nodes: [], edges: [] };

  const included = new Set(seeds);
  for (let i = 0; i < hops; i++) {
    for (const e of graph.edges) {
      const ends = edgeEnds(e);
      if (!ends) continue;
      if (included.has(ends[0])) included.add(ends[1]);
      else if (included.has(ends[1])) included.add(ends[0]);
    }
  }

  return {
    nodes: graph.nodes.filter((n) => included.has(n.id)),
    edges: graph.edges.filter((e) => {
      const ends = edgeEnds(e);
      return !!ends && included.has(ends[0]) && included.has(ends[1]);
    }),
  };
}
