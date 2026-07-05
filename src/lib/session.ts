// Server-side access gates for API route handlers. Each returns either the
// caller's email (authorized) or a ready-to-return NextResponse (401/403).
// Usage:
//   const gate = await requireMember(slug);
//   if ("error" in gate) return gate.error;
//   // gate.email is a verified member of `slug`

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRole, isMember } from "./members";

export type Gate = { email: string } | { error: NextResponse };

export async function currentEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}

const unauthorized = () =>
  NextResponse.json({ error: "Authentication required" }, { status: 401 });

export async function requireMember(slug: string): Promise<Gate> {
  const email = await currentEmail();
  if (!email) return { error: unauthorized() };
  if (!(await isMember(slug, email))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { email };
}

export async function requireOwner(slug: string): Promise<Gate> {
  const email = await currentEmail();
  if (!email) return { error: unauthorized() };
  if ((await getRole(slug, email)) !== "owner") {
    return { error: NextResponse.json({ error: "Owner access required" }, { status: 403 }) };
  }
  return { email };
}
