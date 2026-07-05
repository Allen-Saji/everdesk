// GDPR forget-me: hard-delete every memory data item belonging to a customer
// (durable writes are named "<customerId>-<ts>.txt"), then drop KV records.

import { NextRequest, NextResponse } from "next/server";
import { deleteDataItem, listDataItems } from "@/lib/cognee";
import { getCompany, getCustomer } from "@/lib/companies";
import { emitEvent } from "@/lib/events";
import { kv } from "@/lib/kv";
import { requireMember } from "@/lib/session";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const gate = await requireMember(slug);
  if ("error" in gate) return gate.error;
  const company = await getCompany(slug);
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });
  const customer = await getCustomer(slug, id);

  try {
    const items = await listDataItems(company.memoryId).catch(() => []);
    const mine = items.filter((it) => {
      const name = String(it.name ?? "");
      return name.includes(id);
    });
    let deleted = 0;
    for (const it of mine) {
      await deleteDataItem(company.memoryId, it.id);
      deleted++;
    }

    if (customer) {
      await Promise.all([
        kv().del(`customer:${slug}:${id}`),
        kv().del(`visitor:${slug}:${customer.visitorId}`),
        kv().srem(`customers:${slug}`, id),
      ]);
    }

    await emitEvent(slug, {
      type: "forget",
      label: `forgot ${id}`,
      detail: `${deleted} memory item${deleted === 1 ? "" : "s"} hard-deleted from ${company.memoryDataset}`,
      customerId: id,
      dataset: company.memoryDataset,
    });
    return NextResponse.json({ status: "forgotten", deleted });
  } catch (e) {
    console.error("forget failed", e);
    return NextResponse.json({ error: "Forget failed" }, { status: 502 });
  }
}
