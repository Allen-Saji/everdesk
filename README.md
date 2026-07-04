# EverDesk

A customer support agent that never forgets a customer.

Companies train an agent on their docs in minutes, embed it with one script
tag, and get support with permanent memory: it recognizes returning customers,
learns from every resolved ticket, and can provably forget anyone who asks.

Built for the Cognee hackathon (Best Use of Cognee Cloud track). Every byte of
agent memory lives in Cognee Cloud knowledge graphs.

## Live

- Product + landing: https://everdesk.allensaji.dev
- Integration docs: https://everdesk.allensaji.dev/docs
- Real deployment: https://px402.allensaji.dev (a real Solana payments SDK
  running the widget in production - click the chat bubble)

## What a stateless bot cannot do

1. **Returning customers are recognized.** A customer comes back days later in
   a fresh session and the agent answers "You previously asked: what is px402
   and how do I install it?" with their actual history.
2. **Resolutions become knowledge.** Mark a conversation resolved and the
   verified fix is written into the knowledge graph plus a skill playbook. The
   next customer with the same problem gets the answer immediately.
3. **Right to be forgotten, provable.** Forgetting a customer hard-deletes
   their memory items from the graph and vector store. Their memory graph
   visibly drops to zero nodes in the dashboard.
4. **You can watch it think.** A live memory feed streams every recall,
   remember, resolve, and forget with latencies.

## How Cognee Cloud is used

Two isolated datasets (brains) per company:

- `everdesk-{slug}-kb` - the knowledge base: uploaded docs, pasted text,
  fetched URLs, plus learned resolutions and skill playbooks.
- `everdesk-{slug}-memory` - one shared customer-memory graph. Customer
  identity is embedded in every durable write, so entity extraction builds a
  customer node linked to their issues and resolutions.

Per message: one `POST /api/v1/recall` (GRAPH_COMPLETION) returns the final
answer server-side (no separate LLM key anywhere in this codebase) and logs
the turn into a Cognee Session. Grounded turns are written back with
`POST /api/v1/remember` (durable pipeline) in the background. Resolutions go
to the KB dataset and `POST /api/v1/skills`. Feedback chains to session QA
entries. Forget uses per-item hard deletes. Provisioning registers an agent
connection per company and the dashboard reads Sessions, session stats, and
the dataset graph endpoint for the per-customer visualization.

The full verified API surface, including several behaviors that differ from
the public docs, is in [docs/cognee-api-findings.md](docs/cognee-api-findings.md).

## Integration surface

- **Widget**: `<script src="https://everdesk.allensaji.dev/embed.js"
  data-everdesk-key="pk_..." async></script>` - isolated iframe, no CSS bleed,
  no CORS setup.
- **REST API**: `POST /api/v1/chat` with `{key, visitorId, email?, message}` -
  the widget consumes this same endpoint; wire it into any product or backend.
- **Forget API**: `POST /api/companies/{slug}/customers/{id}/forget` for GDPR
  flows.
- **Actions**: companies configure webhook actions in the dashboard (plain-
  English trigger + fields to collect + URL). A Groq-routed tool call decides
  when to fire; payloads are HMAC-signed (`X-Everdesk-Signature`), SSRF-guarded
  (https only, public addresses only, no redirects, socket-time DNS checks),
  rate-capped (5/customer/hour, 100/company/day, 60s dedupe), and every fired
  action is written back into the customer's memory graph so the agent
  remembers what it did. Docs: `/docs#actions`.

## Known limitations

The dashboard is unauthenticated (hackathon build): anyone who knows a company
slug can read its dashboard and edit its action configs. Action endpoints are
rate limited per slug and per IP, secrets are write-only, and webhook responses
are never reflected, but config integrity ultimately needs dashboard auth.

## Stack

Next.js (App Router, TypeScript, Tailwind v4) on Vercel. Upstash Redis for
company records and the ops-event feed. Cognee Cloud over plain REST for all
memory, retrieval, sessions, skills, and graph data. Cytoscape for the
customer memory graph.

## Local development

```bash
npm install
cp .env.local.example .env.local   # add Cognee Cloud + Upstash credentials
npm run dev
```

`scripts/spike.mjs`, `spike2.mjs`, and `spike3.mjs` verify the Cognee endpoint
behavior against a real tenant. `scripts/test-beats.sh` runs the full memory
beat suite against a local server.

## License

MIT
