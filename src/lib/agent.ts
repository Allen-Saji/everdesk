// The support-agent chat turn, shared by the public API and the dashboard
// playground. One recall answers + logs the session; durable customer memory
// is written separately (findings #1, #4).

import { recall, rememberDurable, RecallResult } from "./cognee";
import { Company, Visitor } from "./companies";
import { emitEvent } from "./events";

const REFUSAL =
  /don'?t have|do not have|no (information|relevant)|not (in|part of|available)|cannot (find|answer)|couldn'?t find|i'?m sorry|unable to/i;

export function isRefusal(text: string): boolean {
  return REFUSAL.test(text) && text.length < 400;
}

export function buildSystemPrompt(company: Company): string {
  return (
    company.persona ??
    `You are the customer support agent for ${company.name}. Answer using ONLY facts from the provided context (the company's knowledge base and this customer's own history). Be concise, warm, and specific. If the customer's history shows past issues, acknowledge them naturally. If the context does not contain the answer, say you do not have that information yet and offer to pass the question to the team. Never invent order numbers, dates, events, or product behavior.`
  );
}

export function customerPrefix(visitor: Visitor): string {
  const who = visitor.email
    ? `${visitor.customerId} (${visitor.email})`
    : visitor.customerId;
  return `Customer ${who}`;
}

function pickAnswer(results: RecallResult[]): { text: string; source: string } | null {
  const completions = results.filter(
    (r) => typeof r.text === "string" && r.text.length > 0,
  );
  if (!completions.length) return null;
  const grounded = completions.filter((r) => !isRefusal(r.text!));
  const pool = grounded.length ? grounded : completions;
  // Prefer the most informative grounded answer.
  pool.sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0));
  const best = pool[0];
  return { text: best.text!, source: best.dataset_name ?? "graph" };
}

export interface ChatTurnResult {
  answer: string;
  grounded: boolean;
  sessionId: string;
  customerId: string;
  latencyMs: number;
}

export async function runChatTurn(opts: {
  company: Company;
  visitor: Visitor;
  sessionId: string;
  message: string;
  /** schedule post-response work (Next's after()); falls back to fire-and-forget */
  defer?: (task: () => Promise<unknown>) => void;
}): Promise<ChatTurnResult> {
  const { company, visitor, sessionId, message } = opts;
  const defer = opts.defer ?? ((task) => void task().catch(() => {}));
  const t0 = Date.now();

  const results = await recall({
    query: `${customerPrefix(visitor)} asks: ${message}`,
    datasets: [company.kbDataset, company.memoryDataset],
    sessionId,
    systemPrompt: buildSystemPrompt(company),
    topK: 12,
  });
  const latencyMs = Date.now() - t0;

  const picked = pickAnswer(results);
  const grounded = !!picked && !isRefusal(picked.text);
  const answer =
    picked?.text ??
    "I could not reach the knowledge base just now. Please try again in a moment.";

  defer(() =>
    emitEvent(company.slug, {
      type: "recall",
      label: `recall for ${visitor.customerId}`,
      detail: message.slice(0, 120),
      latencyMs,
      customerId: visitor.customerId,
      dataset: picked?.source,
    }),
  );

  if (grounded) {
    // Durable per-customer memory: background pipeline into the memory graph.
    const date = new Date().toISOString().slice(0, 10);
    const text = `${customerPrefix(visitor)} asked on ${date}: "${message}"\nThe support agent answered: "${answer}"`;
    defer(async () => {
      await rememberDurable({
        text,
        filename: `${visitor.customerId}-${Date.now()}.txt`,
        datasetName: company.memoryDataset,
        nodeSet: [`customer:${visitor.customerId}`],
        runInBackground: true,
      });
      await emitEvent(company.slug, {
        type: "remember",
        label: `remember ${visitor.customerId}`,
        detail: `QA turn stored in ${company.memoryDataset}`,
        customerId: visitor.customerId,
        dataset: company.memoryDataset,
      });
    });
  }

  return {
    answer,
    grounded,
    sessionId,
    customerId: visitor.customerId,
    latencyMs,
  };
}

export function mintSessionId(slug: string, customerId: string): string {
  return `everdesk-${slug}-${customerId.replace(/^cust_/, "")}-${Date.now()}`;
}
