// P0 spike3 (final): durable customer-memory path.
// /remember multipart WITHOUT session_id (sync) -> pipeline runs -> graph has customer node -> recall w/ nodeName finds history.
// Plus: session-cache recall short-circuit (same sessionId).

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
const BASE = (process.env.COGNEE_BASE_URL || "").replace(/\/$/, "");
const KEY = process.env.COGNEE_API_KEY || "";
const TENANT = process.env.COGNEE_TENANT_ID || "";
if (!BASE || !KEY) { console.error("[ABORT] missing env"); process.exit(1); }

const RUN = Date.now();
const MEM = `everdesk-spike3-memory-${RUN}`;
const SESSION = `everdesk-spike3-${RUN}`;
const CUSTOMER = "cust_jane01";
const results = [];
const record = (s, ok, n = "") => { results.push({ s, ok, n }); console.log(`\n${ok ? "[PASS]" : "[FAIL]"} ${s}${n ? " - " + n : ""}`); };
const trunc = (x, n = 800) => { const s = typeof x === "string" ? x : JSON.stringify(x); return s.length > n ? s.slice(0, n) + ` ...(${s.length})` : s; };

async function req(method, path, { json, form } = {}) {
  const h = { "X-Api-Key": KEY, ...(TENANT ? { "X-Tenant-Id": TENANT } : {}) };
  let body;
  if (json !== undefined) { h["Content-Type"] = "application/json"; body = JSON.stringify(json); }
  else if (form !== undefined) body = form;
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  console.log(`  ${method} ${path} -> ${res.status} (${Date.now() - t0}ms)\n  ${trunc(data)}`);
  return { status: res.status, data, ok: res.ok };
}

let memId = null;
try {
  const d = await req("POST", "/api/v1/datasets/", { json: { name: MEM } });
  memId = d.data?.id ?? null;
  record("dataset create", d.ok && !!memId);

  // durable write: NO session_id, sync
  const form = new FormData();
  form.append("data", new Blob([
    `Customer ${CUSTOMER} (jane@acme.io) contacted px402 support on 2026-07-01 about the PX402_NO_FUNDS error. Resolution: funded the fee payer wallet with 0.1 SOL and the issue was resolved. ${CUSTOMER} uses px402 SDK v0.1.1 on devnet with a dual-mint setup.`,
  ], { type: "text/plain" }), "cust_jane01-history.txt");
  form.append("datasetName", MEM);
  form.append("node_set", JSON.stringify([`customer:${CUSTOMER}`]));
  form.append("run_in_background", "false");
  const r = await req("POST", "/api/v1/remember", { form });
  const ran = r.ok && (r.data?.items_processed > 0 || r.data?.pipeline_run_id || !/session_stored/.test(JSON.stringify(r.data)));
  record("remember multipart NO session (pipeline ran)", ran, `status=${r.data?.status} items=${r.data?.items_processed}`);

  // graph now populated? customer node present?
  const g = await req("GET", `/api/v1/datasets/${memId}/graph`);
  const gs = JSON.stringify(g.data);
  const nodeCount = g.data?.nodes?.length ?? 0;
  const custNode = /jane|cust_jane01/i.test(gs);
  record("graph populated w/ customer node", g.ok && nodeCount > 0 && custNode, `nodes=${nodeCount} customerNode=${custNode}`);

  // returning-customer recall via nodeName filter (fresh session)
  const rc = await req("POST", "/api/v1/recall", {
    json: { query: `What do we know about customer ${CUSTOMER}? Any past issues and how were they resolved?`, datasets: [MEM], sessionId: `${SESSION}-return`, nodeName: [`customer:${CUSTOMER}`], topK: 10 },
  });
  const hit = rc.ok && /NO_FUNDS|fee payer|0\.1 SOL|resolved/i.test(JSON.stringify(rc.data));
  record("recall nodeName -> customer history", hit);

  // recall WITHOUT nodeName (plain graph recall) for comparison
  const rc2 = await req("POST", "/api/v1/recall", {
    json: { query: `Has ${CUSTOMER} contacted support before? About what?`, datasets: [MEM], sessionId: `${SESSION}-return2`, topK: 10 },
  });
  const hit2 = rc2.ok && /NO_FUNDS|fee payer|resolved/i.test(JSON.stringify(rc2.data));
  record("recall plain graph -> customer history", hit2);

  // session-cache short-circuit: QAEntry then recall same session, no datasets
  await req("POST", "/api/v1/remember/entry", {
    json: { entry: { type: "qa", question: "Customer cust_bob02 asked: can I use px402 on mainnet?", answer: "Yes, px402 0.1.1 supports mainnet with the dual-mint split." }, dataset_name: MEM, session_id: SESSION },
  });
  const sc = await req("POST", "/api/v1/recall", {
    json: { query: "What did cust_bob02 ask about earlier in this conversation?", sessionId: SESSION, scope: "session" },
  });
  const scHit = sc.ok && /mainnet/i.test(JSON.stringify(sc.data));
  record("session-cache recall short-circuit", scHit);
} catch (e) {
  console.error("[UNCAUGHT]", e.message);
} finally {
  if (memId) { await req("DELETE", `/api/v1/datasets/${memId}`); record("cleanup", true); }
}

console.log("\n=== SUMMARY ===");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.s}${r.n ? "  (" + r.n + ")" : ""}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
