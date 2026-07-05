// Test-fire: sends a signed sample payload (test: true) to the configured
// webhook. Returns only { status, httpStatus } - the third party's response
// body is never reflected (that would be an SSRF read primitive on an
// unauthenticated endpoint). Does not count toward action caps or fireCount.

import { NextRequest, NextResponse } from "next/server";
import { getCompany } from "@/lib/companies";
import { callerIp, configWriteAllowed, getAction } from "@/lib/actions";
import { ActionPayload, fireWebhook } from "@/lib/webhook";
import { emitEvent } from "@/lib/events";
import { requireMember } from "@/lib/session";

export const maxDuration = 30;

type Params = { params: Promise<{ slug: string; actionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, actionId } = await params;
  const gate = await requireMember(slug);
  if ("error" in gate) return gate.error;
  const company = await getCompany(slug);
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });

  if (!(await configWriteAllowed(slug, callerIp(req)))) {
    return NextResponse.json({ error: "Too many test fires, slow down" }, { status: 429 });
  }

  const action = await getAction(slug, actionId);
  if (!action) return NextResponse.json({ error: "Unknown action" }, { status: 404 });

  const sampleParams = Object.fromEntries(
    action.params.map((p) => [p.key, p.type === "number" ? 0 : "sample"]),
  );
  const payload: ActionPayload = {
    action: action.name,
    test: true,
    company: { slug: company.slug, name: company.name },
    customer: { customerId: "test_customer", email: "test@example.com", name: "Test Customer" },
    params: sampleParams,
    conversation: {
      sessionId: `everdesk-${slug}-test`,
      message: "This is a test fire from the EverDesk dashboard.",
      answer: "This is a sample agent answer.",
    },
    firedAt: new Date().toISOString(),
  };

  const result = await fireWebhook(action, payload);
  await emitEvent(slug, {
    type: "action",
    label: `test fire ${action.name}`,
    detail: `${result.status}${result.httpStatus ? ` (HTTP ${result.httpStatus})` : ""}`,
    latencyMs: result.ms,
  });
  return NextResponse.json({ status: result.status, httpStatus: result.httpStatus ?? null });
}
