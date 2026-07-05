import { NextRequest, NextResponse } from "next/server";
import { recentEvents } from "@/lib/events";
import { requireMember } from "@/lib/session";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  const gate = await requireMember(slug);
  if ("error" in gate) return gate.error;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);
  const events = await recentEvents(slug, limit);
  return NextResponse.json({ events });
}
