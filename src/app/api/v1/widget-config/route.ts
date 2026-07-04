// Public widget bootstrap info for a company key (name only; no secrets).

import { NextRequest, NextResponse } from "next/server";
import { getCompanyByKey } from "@/lib/companies";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });
  const company = await getCompanyByKey(key);
  if (!company) return NextResponse.json({ error: "Unknown key" }, { status: 404 });
  return NextResponse.json({ name: company.name, slug: company.slug });
}
