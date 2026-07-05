// Learn-from-resolution: writes the resolved issue into the KB graph so every
// future customer gets the answer instantly. Also registers a skill playbook.

import { NextRequest, NextResponse } from "next/server";
import { ingestSkill, rememberDurable } from "@/lib/cognee";
import { getCompany } from "@/lib/companies";
import { emitEvent } from "@/lib/events";
import { requireMember } from "@/lib/session";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await requireMember(slug);
  if ("error" in gate) return gate.error;
  const company = await getCompany(slug);
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });

  let body: { problem?: string; solution?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const problem = body.problem?.trim();
  const solution = body.solution?.trim();
  if (!problem || !solution) {
    return NextResponse.json({ error: "problem and solution required" }, { status: 400 });
  }

  try {
    const date = new Date().toISOString().slice(0, 10);
    await rememberDurable({
      text: `Resolved support issue (${date}).\nProblem: ${problem}\nVerified solution: ${solution}`,
      filename: `resolution-${Date.now()}.txt`,
      datasetName: company.kbDataset,
      runInBackground: true,
    });
    // Skill playbook: how to handle this class of issue next time.
    await ingestSkill(
      `# Handling: ${problem.slice(0, 80)}\n\nWhen a customer reports: ${problem}\n\nRespond with the verified solution:\n${solution}\n`,
      `resolution-${date}-${Date.now()}`,
      company.kbDataset,
    ).catch(() => {});
    await emitEvent(slug, {
      type: "resolve",
      label: "resolution learned",
      detail: problem.slice(0, 120),
      dataset: company.kbDataset,
    });
    return NextResponse.json({ status: "learned" });
  } catch (e) {
    console.error("resolve failed", e);
    return NextResponse.json({ error: "Failed to store resolution" }, { status: 502 });
  }
}
