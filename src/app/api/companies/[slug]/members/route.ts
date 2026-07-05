// Team management. GET lists members (any member can view). POST invites a
// teammate by email and DELETE removes one - both owner-only. The owner cannot
// be removed. Inviting only allowlists an email; the person gains access when
// they sign in with that Google account.

import { NextRequest, NextResponse } from "next/server";
import { getCompany } from "@/lib/companies";
import { addMember, getRole, listMembers, normalizeEmail, removeMember } from "@/lib/members";
import { requireMember, requireOwner } from "@/lib/session";

type Params = { params: Promise<{ slug: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const gate = await requireMember(slug);
  if ("error" in gate) return gate.error;
  return NextResponse.json({ members: await listMembers(slug), you: gate.email });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const gate = await requireOwner(slug);
  if ("error" in gate) return gate.error;
  const company = await getCompany(slug);
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = normalizeEmail(body.email ?? "");
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (await getRole(slug, email)) {
    return NextResponse.json({ error: "Already a member" }, { status: 409 });
  }
  await addMember(slug, email, "member");
  return NextResponse.json({ members: await listMembers(slug) }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const gate = await requireOwner(slug);
  if ("error" in gate) return gate.error;

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = normalizeEmail(body.email ?? "");
  const role = await getRole(slug, email);
  if (!role) return NextResponse.json({ error: "Not a member" }, { status: 404 });
  if (role === "owner") {
    return NextResponse.json({ error: "The owner cannot be removed" }, { status: 400 });
  }
  await removeMember(slug, email);
  return NextResponse.json({ members: await listMembers(slug) });
}
