// The support-agent chat turn, shared by the public API and the dashboard
// playground. One recall answers + logs the session; durable customer memory
// is written separately (findings #1, #4).

import { recall, rememberDurable, RecallResult } from "./cognee";
import { Company, Visitor } from "./companies";
import { emitEvent } from "./events";
import { env } from "./env";
import {
  bumpFireCount,
  checkAndCountAction,
  checkRouterBudget,
  dedupeFire,
  listEnabledActions,
} from "./actions";
import { routeAction } from "./action-router";
import {
  ActionPayload,
  fireWebhook,
  renderReceipt,
  sanitizeInline,
} from "./webhook";

const REFUSAL =
  /don'?t have|do not have|no (information|relevant)|not (in|part of|available)|cannot (find|answer)|couldn'?t find|i'?m sorry|unable to/i;

export function isRefusal(text: string): boolean {
  return REFUSAL.test(text) && text.length < 400;
}

export function buildSystemPrompt(company: Company): string {
  return (
    company.persona ??
    `You are the customer support agent for ${company.name}. Answer using ONLY facts from the provided context (the company's knowledge base and this customer's own history). Be concise, warm, and specific. If the customer's history shows past issues, acknowledge them naturally. If the context does not contain the answer, say you do not have that information yet and offer to pass the question to the team. Never invent order numbers, dates, events, or product behavior. Write in plain conversational text without markdown formatting (no asterisks, no headers); short paragraphs and simple numbered steps are fine.`
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
  /** Present only when a configured action actually fired this turn. */
  action?: { name: string; status: "fired" };
}

/**
 * Cheap customer-history lookup: CHUNKS retrieval (no LLM, no session entry).
 * Chunks are filtered to this customer via the identity token embedded in
 * every durable write, so one shared memory graph never leaks across
 * customers.
 */
async function customerMemoryContext(
  memoryDataset: string,
  customerId: string,
  message: string,
): Promise<string> {
  try {
    const results = await recall({
      query: `${customerId} ${message}`,
      datasets: [memoryDataset],
      searchType: "CHUNKS",
      topK: 8,
    });
    const chunks = results
      .map((r) =>
        typeof r.text === "string"
          ? r.text
          : typeof (r as { search_result?: unknown }).search_result === "string"
            ? String((r as { search_result?: unknown }).search_result)
            : "",
      )
      .filter((t) => t.includes(customerId));
    return chunks.join("\n---\n").slice(0, 4000);
  } catch {
    return ""; // empty or brand-new memory graph
  }
}

/**
 * The actions layer: after the answer is decided, ask the Groq router whether
 * one configured action should fire, gate it (budget, rate caps, dedupe), fire
 * the webhook in-request so the receipt is truthful, and defer bookkeeping.
 * Every failure path returns null: the answer is never blocked by this layer.
 */
async function maybeFireAction(opts: {
  company: Company;
  visitor: Visitor;
  sessionId: string;
  message: string;
  answer: string;
  grounded: boolean;
  history: string;
  defer: (task: () => Promise<unknown>) => void;
}): Promise<{ name: string; receipt: string } | null> {
  const { company, visitor, defer } = opts;
  try {
    if (!env.groqApiKey) return null;
    const configs = await listEnabledActions(company.slug);
    if (!configs.length) return null;
    if (!(await checkRouterBudget(company.slug))) return null;

    const routed = await routeAction({
      configs,
      message: opts.message,
      answer: opts.answer,
      grounded: opts.grounded,
      history: opts.history,
    });
    if (!routed) return null;
    const label = `${routed.config.name} for ${visitor.customerId}`;

    const gate = await checkAndCountAction(company.slug, visitor.customerId);
    if (gate !== "ok") {
      defer(() =>
        emitEvent(company.slug, {
          type: "action",
          label,
          detail: `skipped: ${gate}`,
          customerId: visitor.customerId,
        }),
      );
      return null;
    }
    if (!(await dedupeFire(company.slug, routed.config.id, visitor.customerId, routed.params))) {
      defer(() =>
        emitEvent(company.slug, {
          type: "action",
          label,
          detail: "skipped: duplicate fire within 60s",
          customerId: visitor.customerId,
        }),
      );
      return null;
    }

    const payload: ActionPayload = {
      action: routed.config.name,
      test: false,
      company: { slug: company.slug, name: company.name },
      customer: {
        customerId: visitor.customerId,
        email: visitor.email,
        name: visitor.name,
      },
      params: routed.params,
      conversation: {
        sessionId: opts.sessionId,
        message: opts.message,
        answer: opts.answer.slice(0, 4000),
      },
      firedAt: new Date().toISOString(),
    };
    const result = await fireWebhook(routed.config, payload);

    if (result.status !== "fired") {
      defer(() =>
        emitEvent(company.slug, {
          type: "action",
          label,
          detail: `${result.status}${result.httpStatus ? ` (HTTP ${result.httpStatus})` : ""}`,
          latencyMs: result.ms,
          customerId: visitor.customerId,
        }),
      );
      return null;
    }

    // Success bookkeeping is deferred; the memory record is bounded and
    // sanitized (params are customer-influenced text) and written only on 2xx.
    const date = new Date().toISOString().slice(0, 10);
    const paramsText = Object.entries(routed.params)
      .map(([k, v]) => `${k}=${sanitizeInline(v, 80)}`)
      .join(", ");
    const memoryText = sanitizeInline(
      `${customerPrefix(visitor)}: on ${date} the support agent performed the action "${routed.config.name}"${paramsText ? ` (${paramsText})` : ""} for this customer and it was delivered successfully.`,
      300,
    );
    defer(async () => {
      await bumpFireCount(company.slug, routed.config.id);
      await rememberDurable({
        text: memoryText,
        filename: `${visitor.customerId}-action-${Date.now()}.txt`,
        datasetName: company.memoryDataset,
        nodeSet: [`customer:${visitor.customerId}`],
        runInBackground: true,
      });
      await emitEvent(company.slug, {
        type: "action",
        label,
        detail: `fired (HTTP ${result.httpStatus}) in ${result.ms}ms`,
        latencyMs: result.ms,
        customerId: visitor.customerId,
        dataset: company.memoryDataset,
      });
    });

    return {
      name: routed.config.name,
      receipt: renderReceipt(routed.config.receiptTemplate, routed.config.name, routed.params),
    };
  } catch {
    return null; // fail closed for the action, open for the answer
  }
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

  // Step 1: customer history (cheap, sessionless - avoids the per-dataset
  // double logging and double LLM completion of a multi-dataset recall).
  const history = await customerMemoryContext(
    company.memoryDataset,
    visitor.customerId,
    message,
  );

  // Step 2: ONE recall against the KB = one completion, one session entry.
  const historyBlock = history
    ? `\n\nWhat you remember about this customer from previous conversations:\n${history}\nUse this history naturally when relevant.`
    : "\n\nThis appears to be a new customer with no previous history.";
  const results = await recall({
    query: `${customerPrefix(visitor)} asks: ${message}`,
    datasets: [company.kbDataset],
    sessionId,
    systemPrompt: buildSystemPrompt(company) + historyBlock,
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

  // Actions layer: no-op unless the company configured actions AND the Groq
  // key is present. The webhook fires in-request so the receipt is truthful.
  const fired = await maybeFireAction({
    company,
    visitor,
    sessionId,
    message,
    answer,
    grounded,
    history,
    defer,
  });

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
    answer: fired ? `${answer}\n\n${fired.receipt}` : answer,
    grounded,
    sessionId,
    customerId: visitor.customerId,
    latencyMs,
    ...(fired ? { action: { name: fired.name, status: "fired" as const } } : {}),
  };
}

export function mintSessionId(slug: string, customerId: string): string {
  return `everdesk-${slug}-${customerId.replace(/^cust_/, "")}-${Date.now()}`;
}
