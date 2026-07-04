import { NextRequest, NextResponse } from "next/server";
import { datasetGraph } from "@/lib/cognee";
import { getCompany } from "@/lib/companies";
import { customerSubgraph } from "@/lib/graph";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const company = await getCompany(slug);
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });

  try {
    const graph = await datasetGraph(company.memoryId);
    const sub = customerSubgraph(graph, id);
    return NextResponse.json({
      ...sub,
      totalNodes: graph.nodes.length,
      customerNodes: sub.nodes.length,
    });
  } catch (e) {
    console.error("graph fetch failed", e);
    return NextResponse.json({ error: "Graph unavailable" }, { status: 502 });
  }
}
