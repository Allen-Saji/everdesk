# Cognee Cloud API findings (P0 spike, verified 2026-07-04)

Verified against the real tenant with scripts/spike.mjs, spike2.mjs, spike3.mjs.
These findings override docs.cognee.ai where they differ. OpenAPI spec snapshot
was pulled from <tenant>/openapi.json.

## Auth
- Headers: `X-Api-Key: <key>` + `X-Tenant-Id: <tenant>` on every call.
- Base URL: `https://<tenant>.aws.cognee.ai`, all endpoints under `/api/v1`.
- `GET /health` exists.

## Behavioral findings (the important stuff)

1. `POST /api/v1/recall` is the whole chat turn: returns the final LLM answer
   (GRAPH_COMPLETION, server side, no LLM key) AND auto-logs the Q&A into the
   session (`qa_id` comes back in session records). One call per message.
   Latency observed: 4-9s.
2. Recall over multiple datasets returns ONE completion PER dataset (array).
   The app must merge: prefer the non-refusal answer (heuristic).
3. `POST /api/v1/remember/entry` = session cache ONLY (items_processed=0).
   Body: `{entry: {type:"qa"|"feedback"|..., ...}, dataset_name, session_id}`.
   QAEntry requires question+answer, returns `entry_id`. FeedbackEntry requires
   `qa_id` (chain to a previous QA), takes feedback_score/feedback_text.
4. `POST /api/v1/remember` (multipart) WITH session_id = session cache only.
   WITHOUT session_id = real add+cognify pipeline (status:"completed",
   items_processed>0, ~16-19s sync for a paragraph). THIS is the durable
   memory write. Use run_in_background=true in the app.
5. Session cache recall: `{sessionId, scope:"session"}` short-circuits and
   returns cached QA turns instantly (~500ms). Recall body uses camelCase
   `sessionId` (snake_case also appears to be accepted, but use camelCase).
6. `GET /api/v1/datasets/{id}/graph` returns `{nodes:[{id,label,type,properties}],
   edges:[...]}` - perfect for our own light-theme viz (cytoscape). A single
   paragraph produced 20 nodes incl. the customer entity.
7. `GET /api/v1/visualize?dataset_id=` returns a self-contained dark-theme D3
   HTML page (external CDN deps). Bonus "raw brain" view only, not primary viz.
8. `GET /api/v1/quotas/usage` = storage only ({storageLimitInBytes, storageUsedInBytes}).
   Token credit balance has NO API - check platform.cognee.ai billing manually
   before the demo.
9. Agents: docs' `/agents/create` (API-key-per-agent) DOES NOT EXIST here.
   `POST /api/v1/agents/register` registers an agent connection:
   `{agent_session_name, type:"api", memory_mode, dataset_names[], source, metadata}`
   -> `{id, datasets:[{name, role:"read_write"}], status:"active", ...}`.
   Visible in cloud UI - use for the Act 1 provisioning beat.
10. `POST /api/v1/datasets/` (trailing slash) `{name}` -> `{id, name, ownerId, createdAt}`.
    Idempotent by name (returns existing).
11. Status poll gotcha: value is `DATASET_PROCESSING_COMPLETED` - do not regex
    for "PROCESSING" as an in-progress signal.
12. `POST /api/v1/forget` `{dataset|datasetId, dataId?, memoryOnly?, everything?}`
    -> `{data_records_reset, status:"success"}`. Works.
13. Sessions: `GET /sessions` list, `/sessions/{id}` detail is RICH: auto label
    from first question, msg_count, qas[] transcript with feedback fields,
    tokens, cost_usd, status. `/sessions/stats`, `/sessions/cost-by-model` work.
14. `POST /api/v1/add_text` (JSON): `{textData:[...], datasetName, nodeSet}` -
    pasted-text training without multipart.
15. node_set encoding caveat: passing `JSON.stringify(["customer:x"])` as a
    multipart field stored the literal JSON string as the set name
    (belongs_to_set: ["[\"customer:x\"]"]). Pass plain strings. VERIFY the
    correct multi-value encoding in P1 playground before relying on nodeName
    filtering.
16. HALLUCINATION WARNING: nodeName-filtered GRAPH_COMPLETION with a broken
    filter fabricated plausible customer history. Plain graph recall (no
    nodeName) was grounded and precise. Defaults: plain recall + strict
    grounding systemPrompt ("only state facts from context; say you don't know
    otherwise"). Customer scoping comes from the customer token embedded in
    remembered text + the query.

17. DELETE-RESIDUE WARNING (verified 2026-07-04): dataset ids are
    deterministic by name+owner. Deleting a dataset and recreating the same
    name yields the SAME id with broken server-side residue - cognify then
    returns DATASET_PROCESSING_ERRORED reproducibly, while a fresh name works.
    Rule: never reuse a deleted dataset name. Test companies get unique slugs;
    the demo company (px402) is provisioned once and never deleted.

## EverDesk architecture consequences

- Chat turn = 1 recall (answer + session log). Thumbs = FeedbackEntry chained
  to the recall's qa_id (read from session detail) OR our own QAEntry ids.
- Durable per-customer memory = `/remember` multipart, NO session_id,
  run_in_background=true, into `everdesk-{slug}-memory`, customer token in text.
  Written at conversation end + on resolution (controlled billing moments).
- Resolution -> same durable write into `everdesk-{slug}-kb` (+ optional skill).
- Graph viz = `GET /datasets/{id}/graph` + cytoscape, filter nodes by customer
  token client-side.
- Provisioning = datasets/ x2 + agents/register (+ optional permission grant).
- Search enum (17): SUMMARIES, CHUNKS, RAG_COMPLETION, HYBRID_COMPLETION,
  TRIPLET_COMPLETION, GRAPH_COMPLETION, GRAPH_COMPLETION_DECOMPOSITION,
  GRAPH_SUMMARY_COMPLETION, CYPHER, NATURAL_LANGUAGE, GRAPH_COMPLETION_COT,
  GRAPH_COMPLETION_CONTEXT_EXTENSION, FEELING_LUCKY, TEMPORAL, CODING_RULES,
  CHUNKS_LEXICAL, AGENTIC_COMPLETION.

## Cost notes
- Tiny corpora for all testing. Pipeline runs are the billable moments;
  recalls are cheap. sessions/stats showed $0.00 after spike1.
- ~37 USD credits available (2026-07-04). Check balance morning-of demo.
