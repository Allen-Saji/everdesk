// Single-action update (toggle/edit) and delete. Omitted secret fields are
// preserved, never blanked; a changed URL passes the SSRF gate again.

import { NextRequest, NextResponse } from "next/server";
import { getCompany } from "@/lib/companies";
import {
  ActionInput,
  callerIp,
  configWriteAllowed,
  deleteAction,
  fireCounts,
  toPublic,
  updateAction,
  validateActionInput,
} from "@/lib/actions";
import { assertPublicUrl } from "@/lib/webhook";

type Params = { params: Promise<{ slug: string; actionId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug, actionId } = await params;
  const company = await getCompany(slug);
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });

  if (!(await configWriteAllowed(slug, callerIp(req)))) {
    return NextResponse.json({ error: "Too many changes, slow down" }, { status: 429 });
  }

  let body: Partial<ActionInput> & { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const invalid = validateActionInput(body, { partial: true });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }
  if (body.url !== undefined) {
    try {
      await assertPublicUrl(body.url);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid webhook URL" },
        { status: 422 },
      );
    }
  }

  const updated = await updateAction(slug, actionId, body);
  if (!updated) return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  const counts = await fireCounts(slug, [actionId]);
  return NextResponse.json({ action: toPublic(updated, counts[actionId] ?? 0) });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { slug, actionId } = await params;
  const company = await getCompany(slug);
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });

  if (!(await configWriteAllowed(slug, callerIp(req)))) {
    return NextResponse.json({ error: "Too many changes, slow down" }, { status: 429 });
  }

  const removed = await deleteAction(slug, actionId);
  if (!removed) return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  return NextResponse.json({ status: "deleted" });
}
