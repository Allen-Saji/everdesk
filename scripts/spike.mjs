// P0 spike: verify every Cognee Cloud endpoint EverDesk depends on, against the real tenant.
// Usage: node scripts/spike.mjs [--keep] (keep = skip cleanup of spike datasets)
// Reads .env.local: COGNEE_BASE_URL, COGNEE_API_KEY, COGNEE_TENANT_ID (optional)
// Never prints the API key.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const BASE = (process.env.COGNEE_BASE_URL || "").replace(/\/$/, "");
const KEY = process.env.COGNEE_API_KEY || "";
const TENANT = process.env.COGNEE_TENANT_ID || "";

if (!BASE || !KEY) {
  console.error("[ABORT] Missing env. Need COGNEE_BASE_URL and COGNEE_API_KEY in .env.local");
  console.error(`        COGNEE_BASE_URL set: ${!!BASE}  COGNEE_API_KEY set: ${!!KEY}`);
  process.exit(1);
}
console.log(`[env] base=${BASE} key=set(${KEY.length} chars) tenant=${TENANT ? "set" : "unset"}`);

const KEEP = process.argv.includes("--keep");
const RUN = Date.now();
const KB = `everdesk-spike-kb-${RUN}`;
const MEM = `everdesk-spike-memory-${RUN}`;
const SESSION = `everdesk-spike-${RUN}`;
const CUSTOMER = "cust_spike01";

const results = [];
function record(step, ok, note = "") {
  results.push({ step, ok, note });
  console.log(`\n${ok ? "[PASS]" : "[FAIL]"} ${step}${note ? " - " + note : ""}`);
}
const trunc = (s, n = 900) =>
  s.length > n ? s.slice(0, n) + ` ...(${s.length} chars total)` : s;

async function req(method, path, { json, form, headers = {} } = {}) {
  const url = `${BASE}${path}`;
  const h = { "X-Api-Key": KEY, ...(TENANT ? { "X-Tenant-Id": TENANT } : {}), ...headers };
  let body;
  if (json !== undefined) {
    h["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form !== undefined) {
    body = form; // fetch sets multipart boundary
  }
  const t0 = Date.now();
  const res = await fetch(url, { method, headers: h, body });
  const ms = Date.now() - t0;
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  console.log(`  ${method} ${path} -> ${res.status} (${ms}ms)`);
  console.log(`  ${trunc(typeof data === "string" ? data : JSON.stringify(data))}`);
  return { status: res.status, data, ok: res.ok };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- sample corpus (stands in for px402 docs) ----
const KB_DOC = `EverDesk Spike Product Docs
px402 is a private x402 payments SDK for Solana using MagicBlock ephemeral rollups.
Install with: npm install px402
To configure a payment endpoint, call createPaymentHandler with your mint address.
Common error PX402_NO_FUNDS means the fee payer wallet has no lamports; fund the wallet and retry.
Refund policy: refunds are processed within 7 days via the original payment mint.`;

const steps = {
  async datasetsCreate() {
    // discover create shape; docs say POST /datasets creates or returns existing by name
    let r = await req("POST", "/api/v1/datasets", { json: { name: KB } });
    if (!r.ok) r = await req("POST", "/api/v1/datasets", { json: { datasetName: KB } });
    const kbId = r.data?.id ?? r.data?.dataset_id ?? null;
    let r2 = await req("POST", "/api/v1/datasets", { json: { name: MEM } });
    const memId = r2.data?.id ?? r2.data?.dataset_id ?? null;
    record("datasets.create x2", r.ok && r2.ok, `kbId=${kbId} memId=${memId}`);
    return { kbId, memId };
  },

  async addText() {
    const form = new FormData();
    form.append("data", new Blob([KB_DOC], { type: "text/plain" }), "px402-docs.txt");
    form.append("datasetName", KB);
    const r = await req("POST", "/api/v1/add", { form });
    record("add (text file upload)", r.ok);
    return r;
  },

  async cognify() {
    const r = await req("POST", "/api/v1/cognify", {
      json: { datasets: [KB], runInBackground: true },
    });
    record("cognify (background)", r.ok);
    return r;
  },

  async pollStatus() {
    for (let i = 0; i < 40; i++) {
      const r = await req("GET", "/api/v1/datasets/status");
      const s = JSON.stringify(r.data);
      if (/DATASET_PROCESSING_COMPLETED|completed/i.test(s) && !/IN_PROGRESS|STARTED|processing/i.test(s)) {
        record("datasets.status poll -> completed", true, `${i + 1} polls`);
        return true;
      }
      if (/ERRORED|FAILED/i.test(s)) { record("datasets.status poll", false, "pipeline errored"); return false; }
      await sleep(5000);
    }
    record("datasets.status poll", false, "timeout after 200s");
    return false;
  },

  async searchGraphCompletion() {
    const r = await req("POST", "/api/v1/search", {
      json: { searchType: "GRAPH_COMPLETION", query: "How do I fix the PX402_NO_FUNDS error?", datasets: [KB] },
    });
    const good = r.ok && JSON.stringify(r.data).toLowerCase().includes("fund");
    record("search GRAPH_COMPLETION answers from KB", good, good ? "" : "no expected keyword in answer");
    return r;
  },

  async recallWithSession() {
    const r = await req("POST", "/api/v1/recall", {
      json: {
        query: `Customer ${CUSTOMER} (spike@example.com) asks: what is the refund policy?`,
        session_id: SESSION,
        datasets: [KB, MEM],
      },
    });
    record("recall w/ session_id", r.ok);
    return r;
  },

  async rememberEntryQA() {
    // discriminated union - try the documented QAEntry shape
    const payload = {
      type: "qa",
      question: `Customer ${CUSTOMER} (spike@example.com) asked: how do refunds work?`,
      answer: "Refunds are processed within 7 days via the original payment mint.",
      session_id: SESSION,
      dataset: MEM,
      node_set: [`customer:${CUSTOMER}`],
    };
    let r = await req("POST", "/api/v1/remember/entry", { json: payload });
    if (!r.ok) {
      // variant: capitalized type / different keys
      r = await req("POST", "/api/v1/remember/entry", {
        json: { ...payload, type: "QAEntry" },
      });
    }
    record("remember/entry QAEntry", r.ok);
    return r;
  },

  async recallCustomerMemory() {
    await sleep(4000); // session cache should be immediate; graph bridge is background
    const r = await req("POST", "/api/v1/recall", {
      json: {
        query: `What do we know about customer ${CUSTOMER}? What did they ask before?`,
        session_id: `${SESSION}-2`,
        datasets: [MEM],
        scope: "all",
      },
    });
    const good = r.ok && /refund/i.test(JSON.stringify(r.data));
    record("recall returning-customer memory", good, good ? "" : "prior QA not retrieved yet (bridge lag?)");
    return r;
  },

  async tripleSearchHunt() {
    const candidates = ["TRIPLET_COMPLETION", "CYPHER", "NATURAL_LANGUAGE", "GRAPH_SUMMARY_COMPLETION"];
    let winner = null;
    for (const st of candidates) {
      const r = await req("POST", "/api/v1/search", {
        json: { searchType: st, query: `everything related to px402 refunds`, datasets: [KB] },
      });
      const s = JSON.stringify(r.data);
      const hasTriples = r.ok && /(source|subject|relationship|edge|node|-->|\btriple)/i.test(s) && s.length > 50;
      console.log(`  [triple-hunt] ${st}: ok=${r.ok} triple-ish=${hasTriples}`);
      if (hasTriples && !winner) winner = st;
    }
    record("triple-returning searchType hunt", !!winner, `winner=${winner ?? "NONE - use schema fallback"}`);
    return winner;
  },

  async agentsAndGrants(kbId, memId) {
    const r = await req("POST", `/api/v1/agents/create?name=everdesk-spike-agent-${RUN}`);
    const agentId = r.data?.agentId ?? r.data?.agent_id ?? null;
    let granted = false;
    if (agentId && kbId && memId) {
      const g = await req("POST", `/api/v1/permissions/datasets/${agentId}?permission_name=read`, {
        json: [kbId, memId],
      });
      granted = g.ok;
    }
    record("agents/create + permission grant", r.ok && granted, `agentId=${agentId ?? "n/a"} (key NOT printed)`);
    return agentId;
  },

  async sessions() {
    const r1 = await req("GET", "/api/v1/sessions?limit=5");
    const r2 = await req("GET", "/api/v1/sessions/stats");
    const seen = JSON.stringify(r1.data).includes(SESSION);
    record("sessions list + stats", r1.ok && r2.ok, seen ? "spike session visible" : "spike session NOT in list yet");
  },

  async forgetMemoryOnly() {
    const r = await req("POST", "/api/v1/forget", { json: { dataset: MEM, memoryOnly: true } });
    record("forget memoryOnly", r.ok);
  },

  async cleanup(kbId, memId) {
    if (KEEP) { console.log("\n[keep] skipping cleanup"); return; }
    for (const id of [kbId, memId]) {
      if (id) await req("DELETE", `/api/v1/datasets/${id}`);
    }
    record("cleanup spike datasets", true);
  },
};

// ---- run ----
console.log(`\n=== EverDesk P0 spike vs ${BASE} (run ${RUN}) ===`);
let kbId = null, memId = null;
try {
  ({ kbId, memId } = await steps.datasetsCreate());
  await steps.addText();
  await steps.cognify();
  const done = await steps.pollStatus();
  if (done) await steps.searchGraphCompletion();
  await steps.recallWithSession();
  await steps.rememberEntryQA();
  await steps.recallCustomerMemory();
  if (done) await steps.tripleSearchHunt();
  await steps.agentsAndGrants(kbId, memId);
  await steps.sessions();
  await steps.forgetMemoryOnly();
} catch (e) {
  console.error("\n[UNCAUGHT]", e.message);
} finally {
  await steps.cleanup(kbId, memId);
}

console.log("\n=== SUMMARY ===");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.step}${r.note ? "  (" + r.note + ")" : ""}`);
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
console.log("NOTE: credit balance has no documented API endpoint - check platform.cognee.ai billing page manually before the judged demo.");
process.exit(fails ? 1 : 0);
