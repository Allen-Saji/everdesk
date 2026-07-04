// Company onboarding: provisions Cognee datasets + agent connection, stores
// the company record. Idempotent; safe to re-run live on stage.

import { NextRequest, NextResponse } from "next/server";
import { listCompanies, provisionCompany } from "@/lib/companies";
import { emitEvent } from "@/lib/events";

export const maxDuration = 60;

export async function GET() {
  const companies = await listCompanies();
  // Public keys are exposable by design (like an Intercom app id).
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  let body: { name?: string; siteUrl?: string; persona?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.name || body.name.trim().length < 2) {
    return NextResponse.json({ error: "Company name required" }, { status: 400 });
  }

  try {
    const { company, created } = await provisionCompany({
      name: body.name.trim(),
      siteUrl: body.siteUrl?.trim() || undefined,
      persona: body.persona?.trim() || undefined,
    });
    await emitEvent(company.slug, {
      type: "provision",
      label: `provisioned ${company.slug}`,
      detail: `datasets ${company.kbDataset} + ${company.memoryDataset}, agent ${company.agentConnectionId ?? "n/a"}`,
    });
    return NextResponse.json({ company, created }, { status: created ? 201 : 200 });
  } catch (e) {
    console.error("provisioning failed", e);
    return NextResponse.json({ error: "Provisioning failed" }, { status: 502 });
  }
}
