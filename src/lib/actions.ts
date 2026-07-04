// Customer-configurable webhook actions: per-company config in KV plus the
// rate/budget/dedupe gates that keep a public chat endpoint from abusing them.
// Secrets (header values, signing secrets) never leave the server: every read
// that reaches a client goes through toPublic().

import { randomBytes } from "node:crypto";
import { kv } from "./kv";

export interface ActionParam {
  key: string; // ^[a-z][a-z0-9_]{0,31}$
  type: "string" | "number";
  required: boolean;
  description: string;
}

export interface ActionConfig {
  id: string; // act_<hex>
  name: string; // tool-name-safe: ^[A-Za-z0-9_-]{1,64}$
  description: string; // plain-English "when to trigger"; becomes the tool prompt
  enabled: boolean;
  params: ActionParam[];
  url: string; // https only, SSRF-validated on save and on every fire
  secretHeader?: { name: string; value: string }; // server-side only
  signingSecret: string; // whsec_<hex>, shown once at creation
  receiptTemplate?: string; // {{params.key}} interpolation
  createdAt: string;
}

/** Redacted shape safe to send to the dashboard/browser. */
export interface ActionConfigPublic {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  params: ActionParam[];
  url: string;
  receiptTemplate?: string;
  createdAt: string;
  hasSecretHeader: boolean;
  secretHeaderName?: string;
  fireCount: number;
}

export const MAX_ACTIONS_PER_COMPANY = 10;
export const MAX_PARAMS_PER_ACTION = 10;
export const VISITOR_ACTIONS_PER_HOUR = 5;
export const COMPANY_ACTIONS_PER_DAY = 100;
export const COMPANY_ROUTER_CALLS_PER_DAY = 500;
export const GLOBAL_ROUTER_CALLS_PER_DAY = 10_000;
export const CONFIG_WRITES_PER_MINUTE = 10;

const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
const PARAM_KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;

const actionsKey = (slug: string) => `actions:${slug}`;
const firesKey = (slug: string, id: string) => `action:fires:${slug}:${id}`;

function dayStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}
function hourStamp(): string {
  return new Date().toISOString().slice(0, 13).replace(/[-T]/g, "");
}
function minuteStamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[-T:]/g, "");
}

// ---- config CRUD ----

export async function listActions(slug: string): Promise<ActionConfig[]> {
  return (await kv().get<ActionConfig[]>(actionsKey(slug))) ?? [];
}

export async function listEnabledActions(slug: string): Promise<ActionConfig[]> {
  return (await listActions(slug)).filter((a) => a.enabled);
}

export async function getAction(slug: string, id: string): Promise<ActionConfig | null> {
  return (await listActions(slug)).find((a) => a.id === id) ?? null;
}

async function putActions(slug: string, configs: ActionConfig[]): Promise<void> {
  await kv().set(actionsKey(slug), configs);
}

export interface ActionInput {
  name: string;
  description: string;
  params?: ActionParam[];
  url: string;
  secretHeader?: { name: string; value: string };
  receiptTemplate?: string;
}

export function validateActionInput(
  input: Partial<ActionInput>,
  { partial = false } = {},
): string | null {
  if (!partial || input.name !== undefined) {
    if (typeof input.name !== "string" || !NAME_RE.test(input.name)) {
      return "Action name must be 1-64 letters, digits, underscores or dashes";
    }
  }
  if (!partial || input.description !== undefined) {
    if (
      typeof input.description !== "string" ||
      input.description.trim().length < 10 ||
      input.description.length > 500
    ) {
      return "Trigger description must be 10-500 characters";
    }
  }
  if (!partial || input.url !== undefined) {
    if (typeof input.url !== "string" || !input.url.startsWith("https://")) {
      return "Webhook URL must start with https://";
    }
  }
  if (input.params !== undefined) {
    if (!Array.isArray(input.params) || input.params.length > MAX_PARAMS_PER_ACTION) {
      return `At most ${MAX_PARAMS_PER_ACTION} fields per action`;
    }
    const seen = new Set<string>();
    for (const p of input.params) {
      if (typeof p.key !== "string" || !PARAM_KEY_RE.test(p.key)) {
        return "Field keys must be snake_case, 1-32 chars, starting with a letter";
      }
      if (seen.has(p.key)) return `Duplicate field key: ${p.key}`;
      seen.add(p.key);
      if (p.type !== "string" && p.type !== "number") return "Field type must be string or number";
      if (typeof p.description !== "string" || p.description.length > 200) {
        return "Field descriptions are required and capped at 200 characters";
      }
    }
  }
  if (input.secretHeader !== undefined && input.secretHeader !== null) {
    const h = input.secretHeader;
    if (
      typeof h.name !== "string" ||
      !/^[A-Za-z0-9-]{1,64}$/.test(h.name) ||
      typeof h.value !== "string" ||
      h.value.length < 1 ||
      h.value.length > 512
    ) {
      return "Secret header needs a valid header name and a value under 512 characters";
    }
  }
  if (input.receiptTemplate !== undefined && input.receiptTemplate !== null) {
    if (typeof input.receiptTemplate !== "string" || input.receiptTemplate.length > 300) {
      return "Receipt template is capped at 300 characters";
    }
  }
  return null;
}

export async function createAction(slug: string, input: ActionInput): Promise<ActionConfig> {
  const configs = await listActions(slug);
  if (configs.length >= MAX_ACTIONS_PER_COMPANY) {
    throw new Error(`At most ${MAX_ACTIONS_PER_COMPANY} actions per company`);
  }
  if (configs.some((a) => a.name === input.name)) {
    throw new Error(`An action named "${input.name}" already exists`);
  }
  const action: ActionConfig = {
    id: `act_${randomBytes(8).toString("hex")}`,
    name: input.name,
    description: input.description.trim(),
    enabled: false, // explicit opt-in after a test fire
    params: input.params ?? [],
    url: input.url,
    secretHeader: input.secretHeader,
    signingSecret: `whsec_${randomBytes(24).toString("hex")}`,
    receiptTemplate: input.receiptTemplate?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  await putActions(slug, [...configs, action]);
  return action;
}

/** Omitted secret fields are preserved, never blanked. */
export async function updateAction(
  slug: string,
  id: string,
  patch: Partial<ActionInput> & { enabled?: boolean },
): Promise<ActionConfig | null> {
  const configs = await listActions(slug);
  const idx = configs.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const prev = configs[idx];
  const next: ActionConfig = {
    ...prev,
    name: patch.name ?? prev.name,
    description: patch.description?.trim() ?? prev.description,
    enabled: patch.enabled ?? prev.enabled,
    params: patch.params ?? prev.params,
    url: patch.url ?? prev.url,
    secretHeader: patch.secretHeader ?? prev.secretHeader,
    receiptTemplate:
      patch.receiptTemplate !== undefined
        ? patch.receiptTemplate.trim() || undefined
        : prev.receiptTemplate,
  };
  configs[idx] = next;
  await putActions(slug, configs);
  return next;
}

export async function deleteAction(slug: string, id: string): Promise<boolean> {
  const configs = await listActions(slug);
  const next = configs.filter((a) => a.id !== id);
  if (next.length === configs.length) return false;
  await putActions(slug, next);
  return true;
}

// ---- fire counters ----

export async function bumpFireCount(slug: string, id: string): Promise<void> {
  try {
    await kv().incr(firesKey(slug, id));
  } catch {
    // counter is cosmetic, never break the chat path
  }
}

export async function fireCounts(slug: string, ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const counts = await Promise.all(
    ids.map((id) => kv().get<number>(firesKey(slug, id)).catch(() => 0)),
  );
  return Object.fromEntries(ids.map((id, i) => [id, counts[i] ?? 0]));
}

export function toPublic(cfg: ActionConfig, fireCount = 0): ActionConfigPublic {
  return {
    id: cfg.id,
    name: cfg.name,
    description: cfg.description,
    enabled: cfg.enabled,
    params: cfg.params,
    url: cfg.url,
    receiptTemplate: cfg.receiptTemplate,
    createdAt: cfg.createdAt,
    hasSecretHeader: !!cfg.secretHeader,
    secretHeaderName: cfg.secretHeader?.name,
    fireCount,
  };
}

// ---- gates (KV INCR + TTL). On KV errors: fail open for the answer,
// fail closed for the action, so the chat path never breaks. ----

async function underCap(key: string, cap: number, ttlSeconds: number): Promise<boolean> {
  const n = await kv().incr(key);
  if (n === 1) await kv().expire(key, ttlSeconds);
  return n <= cap;
}

export type ActionGate = "ok" | "visitor_capped" | "company_capped" | "kv_error";

export async function checkAndCountAction(
  slug: string,
  customerId: string,
): Promise<ActionGate> {
  try {
    if (!(await underCap(`rl:action:v:${slug}:${customerId}:${hourStamp()}`, VISITOR_ACTIONS_PER_HOUR, 3600))) {
      return "visitor_capped";
    }
    if (!(await underCap(`rl:action:c:${slug}:${dayStamp()}`, COMPANY_ACTIONS_PER_DAY, 86_400))) {
      return "company_capped";
    }
    return "ok";
  } catch {
    return "kv_error";
  }
}

/** Per-company plus global budget for the shared free-tier Groq key. */
export async function checkRouterBudget(slug: string): Promise<boolean> {
  try {
    const [company, global] = await Promise.all([
      underCap(`rl:router:${slug}:${dayStamp()}`, COMPANY_ROUTER_CALLS_PER_DAY, 86_400),
      underCap(`rl:router:global:${dayStamp()}`, GLOBAL_ROUTER_CALLS_PER_DAY, 86_400),
    ]);
    return company && global;
  } catch {
    return false;
  }
}

/** True when this exact fire has not happened in the last 60s (widget retries
 * and repeated messages must not double-fire the company's webhook). */
export async function dedupeFire(
  slug: string,
  actionId: string,
  customerId: string,
  params: Record<string, unknown>,
): Promise<boolean> {
  try {
    const { createHash } = await import("node:crypto");
    const digest = createHash("sha256")
      .update(`${customerId}|${JSON.stringify(params)}`)
      .digest("hex")
      .slice(0, 16);
    const ok = await kv().set(`dedupe:action:${slug}:${actionId}:${digest}`, 1, {
      nx: true,
      ex: 60,
    });
    return ok === "OK";
  } catch {
    return false;
  }
}

/** First hop of x-forwarded-for; Vercel sets it reliably. */
export function callerIp(req: { headers: { get(name: string): string | null } }): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Config create/update/test are rate limited per slug AND per caller IP: the
 * dashboard has no auth yet, so these endpoints must not become a spam proxy. */
export async function configWriteAllowed(slug: string, ip: string): Promise<boolean> {
  try {
    const [bySlug, byIp] = await Promise.all([
      underCap(`rl:actioncfg:${slug}:${minuteStamp()}`, CONFIG_WRITES_PER_MINUTE, 60),
      underCap(`rl:actioncfg:ip:${ip}:${minuteStamp()}`, CONFIG_WRITES_PER_MINUTE, 60),
    ]);
    return bySlug && byIp;
  } catch {
    return false;
  }
}
