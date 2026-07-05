// Company onboarding: provisions Cognee datasets + agent connection, stores
// the company record. Requires a signed-in user; the creator becomes the
// owning member. Idempotent for existing members; safe to re-run.

import { NextRequest, NextResponse } from "next/server";
import { Company, getCompany, provisionCompany } from "@/lib/companies";
import { listUserCompanies } from "@/lib/members";
import { currentEmail } from "@/lib/session";
import { emitEvent } from "@/lib/events";

export const maxDuration = 60;

// Only the companies the signed-in user belongs to. Public keys are exposable
// by design (like an Intercom app id), but the tenant list is not.
export async function GET() {
  const email = await currentEmail();
  if (!email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const slugs = await listUserCompanies(email);
  const rows = await Promise.all(slugs.map((s) => getCompany(s)));
  return NextResponse.json(rows.filter((c): c is Company => !!c));
}

export async function POST(req: NextRequest) {
  const email = await currentEmail();
  if (!email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

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
      ownerEmail: email,
    });
    await emitEvent(company.slug, {
      type: "provision",
      label: `provisioned ${company.slug}`,
      detail: `datasets ${company.kbDataset} + ${company.memoryDataset}, agent ${company.agentConnectionId ?? "n/a"}`,
    });
    return NextResponse.json({ company, created }, { status: created ? 201 : 200 });
  } catch (e) {
    console.error("provisioning failed", e);
    const msg = e instanceof Error ? e.message : "Provisioning failed";
    // "already exists" means the name/slug is taken by another team.
    if (/already exists/.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: "Provisioning failed" }, { status: 502 });
  }
}
