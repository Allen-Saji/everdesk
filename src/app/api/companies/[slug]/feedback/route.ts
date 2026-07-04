import { NextRequest, NextResponse } from "next/server";
import { rememberEntry } from "@/lib/cognee";
import { getCompany } from "@/lib/companies";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });

  let body: { sessionId?: string; qaId?: string; score?: number; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.sessionId || !body.qaId || typeof body.score !== "number") {
    return NextResponse.json({ error: "sessionId, qaId, score required" }, { status: 400 });
  }

  try {
    await rememberEntry(
      {
        type: "feedback",
        qa_id: body.qaId,
        feedback_score: body.score,
        feedback_text: body.text,
      },
      company.memoryDataset,
      body.sessionId,
    );
    return NextResponse.json({ status: "recorded" });
  } catch (e) {
    console.error("feedback failed", e);
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 502 });
  }
}
