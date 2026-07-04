// Training: accepts JSON {texts[], urls[]} or multipart file uploads, then
// cognifies in the background. Status is polled via GET.

import { NextRequest, NextResponse } from "next/server";
import { addData, addText, cognify, datasetStatus } from "@/lib/cognee";
import { getCompany } from "@/lib/companies";
import { emitEvent } from "@/lib/events";

export const maxDuration = 120;

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });

  const sources: string[] = [];
  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const files = form.getAll("files").filter((f): f is File => f instanceof File);
      if (!files.length) {
        return NextResponse.json({ error: "No files provided" }, { status: 400 });
      }
      await addData(
        files.map((f) => ({ blob: f, filename: f.name })),
        company.kbDataset,
      );
      sources.push(...files.map((f) => f.name));
    } else {
      const body: { texts?: string[]; urls?: string[] } = await req.json();
      const texts = (body.texts ?? []).map((t) => t.trim()).filter(Boolean);
      const urls = (body.urls ?? []).map((u) => u.trim()).filter(Boolean);
      if (!texts.length && !urls.length) {
        return NextResponse.json({ error: "Provide texts or urls" }, { status: 400 });
      }
      for (const u of urls) {
        if (!/^https?:\/\//.test(u)) {
          return NextResponse.json({ error: `Invalid URL: ${u}` }, { status: 400 });
        }
      }
      if (texts.length) {
        await addText(texts, company.kbDataset);
        sources.push(`${texts.length} pasted text${texts.length > 1 ? "s" : ""}`);
      }
      if (urls.length) {
        await addData(urls.map((url) => ({ url })), company.kbDataset);
        sources.push(...urls);
      }
    }

    await cognify([company.kbDataset], true);
    await emitEvent(slug, {
      type: "train",
      label: `training ${company.kbDataset}`,
      detail: sources.join(", ").slice(0, 200),
      dataset: company.kbDataset,
    });
    return NextResponse.json({ status: "training", sources });
  } catch (e) {
    console.error("training failed", e);
    return NextResponse.json({ error: "Training failed" }, { status: 502 });
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });

  const all = await datasetStatus();
  const kb = all[company.kbId] ?? "UNKNOWN";
  const memory = all[company.memoryId] ?? "UNKNOWN";
  const active = (s: string) => s.includes("STARTED") || s.includes("INITIATED");
  return NextResponse.json({
    kb,
    memory,
    training: active(kb),
    errored: kb === "DATASET_PROCESSING_ERRORED",
  });
}
