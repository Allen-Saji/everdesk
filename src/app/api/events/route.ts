import { NextRequest, NextResponse } from "next/server";
import { recentEvents } from "@/lib/events";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);
  const events = await recentEvents(slug, limit);
  return NextResponse.json({ events });
}
