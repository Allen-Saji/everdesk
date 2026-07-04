// Typed Cognee Cloud REST client. Shapes verified against the real tenant
// (see docs/cognee-api-findings.md). All paths under /api/v1.

import { env } from "./env";

export class CogneeError extends Error {
  constructor(
    public status: number,
    public path: string,
    public body: unknown,
  ) {
    super(`Cognee ${status} on ${path}`);
  }
}

async function cogneeFetch<T>(
  method: string,
  path: string,
  opts: { json?: unknown; form?: FormData; query?: Record<string, string> } = {},
): Promise<T> {
  const qs = opts.query ? `?${new URLSearchParams(opts.query)}` : "";
  const headers: Record<string, string> = { "X-Api-Key": env.cogneeApiKey };
  if (env.cogneeTenantId) headers["X-Tenant-Id"] = env.cogneeTenantId;
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    body = opts.form;
  }
  const res = await fetch(`${env.cogneeBaseUrl}${path}${qs}`, { method, headers, body });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) throw new CogneeError(res.status, path, data);
  return data as T;
}

// ---- datasets ----

export interface Dataset {
  id: string;
  name: string;
  createdAt: string;
  ownerId: string;
}

/** Idempotent by name: returns the existing dataset if it already exists. */
export function createDataset(name: string) {
  return cogneeFetch<Dataset>("POST", "/api/v1/datasets/", { json: { name } });
}

export function listDatasets() {
  return cogneeFetch<Dataset[]>("GET", "/api/v1/datasets/");
}

export function deleteDataset(datasetId: string) {
  return cogneeFetch<null>("DELETE", `/api/v1/datasets/${datasetId}`);
}

/** Map of datasetId -> status. Completed value: DATASET_PROCESSING_COMPLETED. */
export function datasetStatus() {
  return cogneeFetch<Record<string, string>>("GET", "/api/v1/datasets/status");
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
}
export interface GraphEdge {
  source?: string;
  target?: string;
  label?: string;
  [k: string]: unknown;
}

export function datasetGraph(datasetId: string) {
  return cogneeFetch<{ nodes: GraphNode[]; edges: GraphEdge[] }>(
    "GET",
    `/api/v1/datasets/${datasetId}/graph`,
  );
}

// ---- ingestion ----

export interface PipelineResult {
  status: string; // "completed" | "session_stored" | ...
  dataset_name: string;
  dataset_id: string | null;
  pipeline_run_id: string | null;
  items_processed: number;
}

/** Plain-text training data (pasted text). */
export function addText(texts: string[], datasetName: string, nodeSet?: string[]) {
  return cogneeFetch<unknown>("POST", "/api/v1/add_text", {
    json: { textData: texts, datasetName, ...(nodeSet ? { nodeSet } : {}) },
  });
}

/** File/URL training data. `data` entries: File/Blob uploads or URL strings. */
export function addData(
  entries: Array<{ blob: Blob; filename: string } | { url: string }>,
  datasetName: string,
  nodeSet?: string[],
) {
  const form = new FormData();
  for (const e of entries) {
    if ("url" in e) form.append("data", e.url);
    else form.append("data", e.blob, e.filename);
  }
  form.append("datasetName", datasetName);
  // Findings #15: pass plain strings, never JSON.stringify.
  if (nodeSet) for (const n of nodeSet) form.append("node_set", n);
  return cogneeFetch<unknown>("POST", "/api/v1/add", { form });
}

export function cognify(datasets: string[], runInBackground = true) {
  return cogneeFetch<unknown>("POST", "/api/v1/cognify", {
    json: { datasets, runInBackground },
  });
}

/**
 * Durable memory write: add+cognify in one call. MUST be called WITHOUT a
 * session_id or it silently becomes a session-cache write (findings #4).
 */
export function rememberDurable(opts: {
  text: string;
  filename: string;
  datasetName: string;
  nodeSet?: string[];
  runInBackground?: boolean;
}) {
  const form = new FormData();
  form.append("data", new Blob([opts.text], { type: "text/plain" }), opts.filename);
  form.append("datasetName", opts.datasetName);
  if (opts.nodeSet) for (const n of opts.nodeSet) form.append("node_set", n);
  form.append("run_in_background", String(opts.runInBackground ?? true));
  return cogneeFetch<PipelineResult>("POST", "/api/v1/remember", { form });
}

/** Ingest a SKILL.md playbook scoped to a dataset. */
export function ingestSkill(skillsText: string, skillName: string, datasetName: string) {
  return cogneeFetch<unknown>("POST", "/api/v1/skills/", {
    json: { skills_text: skillsText, skill_name: skillName, dataset_name: datasetName },
  });
}

// ---- session entries (session cache only, findings #3) ----

export type Entry =
  | { type: "qa"; question: string; answer: string; context?: string }
  | { type: "feedback"; qa_id: string; feedback_score?: number; feedback_text?: string };

export interface EntryResult {
  status: string;
  entry_type: string;
  entry_id: string;
  session_ids: string[];
}

export function rememberEntry(entry: Entry, datasetName: string, sessionId: string) {
  return cogneeFetch<EntryResult>("POST", "/api/v1/remember/entry", {
    json: { entry, dataset_name: datasetName, session_id: sessionId },
  });
}

// ---- recall / search ----

export interface RecallResult {
  kind?: string;
  search_type?: string;
  text?: string;
  dataset_id?: string;
  dataset_name?: string;
  source?: string; // "graph" | "session"
  // session-cache records:
  question?: string;
  answer?: string;
  qa_id?: string;
  [k: string]: unknown;
}

export function recall(opts: {
  query: string;
  datasets?: string[];
  sessionId?: string;
  systemPrompt?: string;
  nodeName?: string[];
  scope?: string | string[];
  topK?: number;
  searchType?: string | null;
}) {
  return cogneeFetch<RecallResult[]>("POST", "/api/v1/recall", { json: opts });
}

// ---- forget ----

export function forget(opts: {
  dataset?: string;
  datasetId?: string;
  dataId?: string;
  memoryOnly?: boolean;
  everything?: boolean;
}) {
  return cogneeFetch<{ data_records_reset: number; status: string }>(
    "POST",
    "/api/v1/forget",
    { json: opts },
  );
}

export function deleteDataItem(datasetId: string, dataId: string) {
  return cogneeFetch<unknown>("DELETE", `/api/v1/datasets/${datasetId}/data/${dataId}`);
}

export interface DataItem {
  id: string;
  name?: string;
  [k: string]: unknown;
}

export function listDataItems(datasetId: string) {
  return cogneeFetch<DataItem[]>("GET", `/api/v1/datasets/${datasetId}/data`);
}

// ---- sessions ----

export interface SessionSummary {
  session_id: string;
  status: string;
  effective_status?: string;
  started_at: string;
  last_activity_at: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  label?: string;
  msg_count?: number;
}

export interface SessionDetail extends SessionSummary {
  qas: Array<{
    time: string;
    question: string;
    answer: string;
    qa_id: string;
    context?: string;
    feedback_text?: string | null;
    feedback_score?: number | null;
  }>;
}

export function listSessions(params: { limit?: number; range?: string; offset?: number } = {}) {
  const query: Record<string, string> = {};
  if (params.limit) query.limit = String(params.limit);
  if (params.range) query.range = params.range;
  if (params.offset) query.offset = String(params.offset);
  return cogneeFetch<{ sessions: SessionSummary[]; total: number; has_more: boolean }>(
    "GET",
    "/api/v1/sessions",
    { query },
  );
}

export function sessionDetail(sessionId: string) {
  return cogneeFetch<SessionDetail>("GET", `/api/v1/sessions/${sessionId}`);
}

export function sessionStats(range = "30d") {
  return cogneeFetch<Record<string, number | string>>("GET", "/api/v1/sessions/stats", {
    query: { range },
  });
}

export function costByModel() {
  return cogneeFetch<unknown>("GET", "/api/v1/sessions/cost-by-model");
}

// ---- agents ----

export interface AgentConnection {
  id: string;
  agent_session_name: string;
  status: string;
  datasets: Array<{ name: string; role: string }>;
}

export function registerAgent(opts: {
  name: string;
  datasetNames: string[];
  metadata?: Record<string, unknown>;
}) {
  return cogneeFetch<AgentConnection>("POST", "/api/v1/agents/register", {
    json: {
      agent_session_name: opts.name,
      type: "api",
      memory_mode: "hybrid",
      dataset_names: opts.datasetNames,
      source: "api",
      metadata: opts.metadata ?? {},
    },
  });
}
