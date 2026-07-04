// Delete a company's Cognee datasets and KV records. Usage: node scripts/cleanup-company.mjs <slug>
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  const p = resolve(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const slug = process.argv[2];
if (!slug) { console.error("usage: node scripts/cleanup-company.mjs <slug>"); process.exit(1); }

const BASE = process.env.COGNEE_BASE_URL.replace(/\/$/, "");
const H = { "X-Api-Key": process.env.COGNEE_API_KEY, "X-Tenant-Id": process.env.COGNEE_TENANT_ID ?? "", "Content-Type": "application/json" };
const KV = process.env.KV_REST_API_URL.replace(/\/$/, "");
const KVH = { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` };

async function kvCmd(...cmd) {
  const r = await fetch(KV, { method: "POST", headers: { ...KVH, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  return (await r.json()).result;
}

// datasets
const datasets = await (await fetch(`${BASE}/api/v1/datasets/`, { headers: H })).json();
for (const d of datasets.filter((d) => d.name === `everdesk-${slug}-kb` || d.name === `everdesk-${slug}-memory`)) {
  const r = await fetch(`${BASE}/api/v1/datasets/${d.id}`, { method: "DELETE", headers: H });
  console.log(`deleted dataset ${d.name}: ${r.status}`);
}

// kv records
const company = await kvCmd("GET", `company:${slug}`);
if (company) {
  const c = typeof company === "string" ? JSON.parse(company) : company;
  await kvCmd("DEL", `company:pk:${c.publicKey}`);
}
const customers = (await kvCmd("SMEMBERS", `customers:${slug}`)) ?? [];
for (const id of customers) await kvCmd("DEL", `customer:${slug}:${id}`);
// visitor:* keys share the customer records; scan for them
let cursor = 0;
do {
  const [next, keys] = await kvCmd("SCAN", cursor, "MATCH", `visitor:${slug}:*`, "COUNT", 100);
  cursor = Number(next);
  for (const k of keys) await kvCmd("DEL", k);
} while (cursor !== 0);
await kvCmd("DEL", `company:${slug}`, `customers:${slug}`, `events:${slug}`);
await kvCmd("SREM", "companies", slug);
console.log(`cleaned company ${slug}`);
