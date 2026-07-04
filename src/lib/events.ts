// Ops-event log backing the live memory-feed judge view. KV list per company,
// capped. Emission is fire-and-forget: the feed must never break the chat path.

import { randomBytes } from "node:crypto";
import { kv } from "./kv";

export type OpsEventType = "recall" | "remember" | "resolve" | "forget" | "train" | "provision";

export interface OpsEvent {
  id: string;
  ts: string;
  type: OpsEventType;
  label: string;
  detail?: string;
  latencyMs?: number;
  customerId?: string;
  dataset?: string;
}

const MAX_EVENTS = 200;
const eventsKey = (slug: string) => `events:${slug}`;

export async function emitEvent(slug: string, event: Omit<OpsEvent, "id" | "ts">): Promise<void> {
  const full: OpsEvent = {
    id: randomBytes(6).toString("hex"),
    ts: new Date().toISOString(),
    ...event,
  };
  try {
    const pipe = kv().pipeline();
    pipe.lpush(eventsKey(slug), JSON.stringify(full));
    pipe.ltrim(eventsKey(slug), 0, MAX_EVENTS - 1);
    await pipe.exec();
  } catch {
    // never let the feed break the hot path
  }
}

export async function recentEvents(slug: string, limit = 50): Promise<OpsEvent[]> {
  const raw = await kv().lrange<string | OpsEvent>(eventsKey(slug), 0, limit - 1);
  return raw
    .map((r) => (typeof r === "string" ? (JSON.parse(r) as OpsEvent) : r))
    .filter(Boolean);
}
