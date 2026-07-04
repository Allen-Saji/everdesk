// P0 spike2: verify remaining unknowns with exact OpenAPI shapes.
// 1 remember/entry QAEntry -> qa_id   2 FeedbackEntry chain   3 /remember multipart w/ node_set (customer memory)
// 4 recall nodeName filter (returning customer)   5 GET datasets/{id}/graph + /visualize shapes
// 6 GET /quotas/usage   7 POST /agents/register
// Usage: node scripts/spike2.mjs

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
const MEM = `everdesk-spike2-memory-${RUN}`;
const SESSION = `everdesk-spike2-${RUN}`;
const CUSTOMER = "cust_jane01";
const results = [];
const record = (s, ok, n = "") => { results.push({ s, ok, n }); console.log(`\n${ok ? "[PASS]" : "[FAIL]"} ${s}${n ? " - " + n : ""}`); };
const trunc = (x, n = 700) => { const s = typeof x === "string" ? x : JSON.stringify(x); return s.length > n ? s.slice(0, n) + ` ...(${s.length})` : s; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  // quotas first (also = balance visibility win)
  const q = await req("GET", "/api/v1/quotas/usage");
  record("quotas/usage", q.ok, trunc(q.data, 200));

  // dataset
  const d = await req("POST", "/api/v1/datasets/", { json: { name: MEM } });
  memId = d.data?.id ?? null;
  record("dataset create", d.ok && !!memId, `memId=${memId}`);

  // remember/entry QAEntry (exact shape)
  const e1 = await req("POST", "/api/v1/remember/entry", {
    json: {
      entry: { type: "qa", question: `Customer ${CUSTOMER} (jane@acme.io) asked: how do refunds work in px402?`, answer: "Refunds are processed within 7 days via the original payment mint.", context: "everdesk spike2" },
      dataset_name: MEM,
      session_id: SESSION,
    },
  });
  const qaId = e1.data?.entry_id ?? e1.data?.qa_id ?? e1.data?.id ?? null;
  record("remember/entry QAEntry", e1.ok, `qa_id=${qaId}`);

  // FeedbackEntry chained
  if (qaId) {
    const e2 = await req("POST", "/api/v1/remember/entry", {
      json: { entry: { type: "feedback", qa_id: qaId, feedback_score: 5, feedback_text: "solved my problem" }, dataset_name: MEM, session_id: SESSION },
    });
    record("remember/entry FeedbackEntry chain", e2.ok);
  } else record("remember/entry FeedbackEntry chain", false, "no qa_id from QAEntry");

  // /remember multipart with node_set -> permanent customer memory (add+cognify)
  const form = new FormData();
  form.append("data", new Blob([
    `Customer ${CUSTOMER} (jane@acme.io) contacted support about the PX402_NO_FUNDS error on 2026-07-01. Resolution: funded fee payer wallet with 0.1 SOL, issue resolved. Customer uses the px402 SDK v0.1.1 on devnet with a dual-mint setup.`,
  ], { type: "text/plain" }), "cust_jane01-history.txt");
  form.append("datasetName", MEM);
  form.append("node_set", JSON.stringify([`customer:${CUSTOMER}`]));
  form.append("session_id", SESSION);
  form.append("run_in_background", "false");
  const r = await req("POST", "/api/v1/remember", { form });
  record("remember multipart w/ node_set (sync)", r.ok);

  // recall with nodeName filter -> returning-customer beat
  const rc = await req("POST", "/api/v1/recall", {
    json: {
      query: `What do we know about customer ${CUSTOMER}? Any past issues?`,
      datasets: [MEM],
      sessionId: `${SESSION}-return`,
      nodeName: [`customer:${CUSTOMER}`],
      topK: 10,
    },
  });
  const hit = rc.ok && /NO_FUNDS|fee payer|resolved/i.test(JSON.stringify(rc.data));
  record("recall nodeName filter finds customer history", hit, hit ? "" : "history not retrieved");

  // graph endpoint shapes
  if (memId) {
    const g = await req("GET", `/api/v1/datasets/${memId}/graph`);
    const gs = JSON.stringify(g.data);
    record("datasets/{id}/graph", g.ok, `nodes/edges-ish=${/node|edge|vertice/i.test(gs)}`);
    const v = await req("GET", `/api/v1/visualize?dataset_id=${memId}`);
    record("visualize", v.ok, `type=${typeof v.data === "string" ? "string/html" : "json"}`);
  }

  // agents/register
  const a = await req("POST", "/api/v1/agents/register", {
    json: { agent_session_name: `everdesk-spike2-agent-${RUN}`, type: "api", memory_mode: "hybrid", dataset_names: [MEM], source: "api", metadata: { product: "everdesk" } },
  });
  record("agents/register", a.ok, trunc(a.data, 150));

  // sessions sanity: did SESSION show with entries?
  const s = await req("GET", `/api/v1/sessions/${SESSION}`);
  record("sessions/{id} detail", s.ok, trunc(s.data, 200));
} catch (e) {
  console.error("[UNCAUGHT]", e.message);
} finally {
  if (memId) { await req("DELETE", `/api/v1/datasets/${memId}`); record("cleanup", true); }
}

console.log("\n=== SUMMARY ===");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.s}${r.n ? "  (" + r.n + ")" : ""}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
