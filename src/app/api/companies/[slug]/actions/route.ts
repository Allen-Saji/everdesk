// Action config CRUD (list + create). Secrets never leave the server: GET
// returns redacted DTOs, and the signing secret is revealed exactly once in
// the POST response. Writes are rate limited per slug AND per IP because the
// dashboard has no auth yet.

import { NextRequest, NextResponse } from "next/server";
import { getCompany } from "@/lib/companies";
import {
  ActionInput,
  callerIp,
  configWriteAllowed,
  createAction,
  fireCounts,
  listActions,
  toPublic,
  validateActionInput,
} from "@/lib/actions";
import { assertPublicUrl } from "@/lib/webhook";
import { emitEvent } from "@/lib/events";
import { requireMember } from "@/lib/session";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const gate = await requireMember(slug);
  if ("error" in gate) return gate.error;
  const company = await getCompany(slug);
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });

  const configs = await listActions(slug);
  const counts = await fireCounts(slug, configs.map((a) => a.id));
  return NextResponse.json({
    actions: configs.map((a) => toPublic(a, counts[a.id] ?? 0)),
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const gate = await requireMember(slug);
  if ("error" in gate) return gate.error;
  const company = await getCompany(slug);
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });

  if (!(await configWriteAllowed(slug, callerIp(req)))) {
    return NextResponse.json({ error: "Too many changes, slow down" }, { status: 429 });
  }

  let body: ActionInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const invalid = validateActionInput(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    await assertPublicUrl(body.url); // SSRF gate on save, not just on fire
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid webhook URL" },
      { status: 422 },
    );
  }

  try {
    const action = await createAction(slug, {
      name: body.name,
      description: body.description,
      params: body.params ?? [],
      url: body.url,
      secretHeader: body.secretHeader || undefined,
      receiptTemplate: body.receiptTemplate || undefined,
    });
    await emitEvent(slug, {
      type: "action",
      label: `configured ${action.name}`,
      detail: new URL(action.url).hostname,
    });
    // The one deliberate exception to "never returned": the receiver needs
    // the signing secret to verify payloads. Shown once, then presence-only.
    return NextResponse.json(
      { action: toPublic(action, 0), signingSecretOnce: action.signingSecret },
      { status: 201 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create action";
    const status = /already exists|At most/.test(msg) ? 409 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
