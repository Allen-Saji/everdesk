// SSRF-safe webhook delivery for the actions layer. The dashboard is
// unauthenticated, so webhook URLs are treated as attacker-controlled:
// https-only, hardened IP blocklist, and DNS validated AT SOCKET TIME via a
// custom undici Agent (a resolve-then-fetch check is rebindable). Payloads are
// serialized once and HMAC-signed over exactly the bytes sent.

import { createHmac } from "node:crypto";
import { lookup as dnsLookup } from "node:dns";
import { lookup as dnsLookupAsync } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, request } from "undici";
import type { ActionConfig } from "./actions";

const FIRE_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 64 * 1024;

// ---- IP blocklist (superset of fetch-docs.ts, kept separate on purpose:
// training fetches tolerate redirects, webhooks must not) ----

export function isBlockedIp(ip: string): boolean {
  const v6 = ip.toLowerCase();
  if (v6.includes(":")) {
    // IPv4-mapped IPv6: validate the embedded IPv4 instead.
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    return (
      v6 === "::" ||
      v6 === "::1" ||
      v6.startsWith("fe8") || // fe80::/10 link-local
      v6.startsWith("fe9") ||
      v6.startsWith("fea") ||
      v6.startsWith("feb") ||
      v6.startsWith("fc") || // fc00::/7 unique local
      v6.startsWith("fd") ||
      v6.startsWith("ff") // ff00::/8 multicast
    );
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // unparseable = blocked
  }
  const [a, b] = parts;
  return (
    a === 0 || // 0.0.0.0/8
    a === 127 || // loopback
    a === 10 || // RFC1918
    (a === 172 && b >= 16 && b <= 31) || // RFC1918
    (a === 192 && b === 168) || // RFC1918
    (a === 169 && b === 254) || // link-local incl. 169.254.169.254 metadata
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
    a >= 224 // multicast + reserved + broadcast
  );
}

const BLOCKED_HOST_RE = /^(localhost|.*\.(local|localhost|internal|home\.arpa))$/i;

/**
 * Save-time / pre-fire validation with friendly errors. NOT sufficient alone
 * (DNS can rebind between this check and the connect): the ssrfAgent below is
 * the authoritative gate.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "https:") throw new Error("Webhook URLs must be https");
  if (url.username || url.password) throw new Error("Credentials in URLs are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOST_RE.test(host)) throw new Error("Internal hosts are not allowed");
  let addrs: Array<{ address: string }>;
  try {
    addrs = isIP(host) ? [{ address: host }] : await dnsLookupAsync(host, { all: true });
  } catch {
    throw new Error(`Could not resolve ${host}`);
  }
  for (const { address } of addrs) {
    if (isBlockedIp(address)) {
      throw new Error("URL resolves to a private or reserved address");
    }
  }
  return url;
}

/**
 * undici Agent whose DNS lookup re-validates every resolved address at the
 * moment the socket connects, closing the resolve-then-connect rebinding gap.
 */
function ssrfAgent(): Agent {
  return new Agent({
    connect: {
      lookup: (hostname, options, callback) => {
        dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
          if (err) return callback(err, "", 0);
          const list = Array.isArray(addresses)
            ? addresses
            : [{ address: String(addresses), family: 4 }];
          for (const a of list) {
            if (isBlockedIp(a.address)) {
              return callback(new Error(`blocked address for ${hostname}`), "", 0);
            }
          }
          if ((options as { all?: boolean }).all) {
            return (callback as unknown as (e: Error | null, a: typeof list) => void)(
              null,
              list,
            );
          }
          callback(null, list[0].address, list[0].family);
        });
      },
    },
  });
}

// ---- signing ----

export function signBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

// ---- receipts / sanitization ----

/** Strip control characters and newlines from text interpolated into
 * customer-visible receipts and memory records. */
export function sanitizeInline(value: unknown, max = 200): string {
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const DEFAULT_RECEIPT = "Done - I've taken care of that and the team has been notified.";

/** Deterministic template rendering: only {{action.name}} and declared
 * {{params.key}} interpolate. No LLM writes the receipt. */
export function renderReceipt(
  template: string | undefined,
  actionName: string,
  params: Record<string, string | number>,
): string {
  const tpl = template?.trim() || DEFAULT_RECEIPT;
  const out = tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path: string) => {
    if (path === "action.name") return sanitizeInline(actionName, 64);
    const m = path.match(/^params\.([a-z][a-z0-9_]{0,31})$/);
    if (m && m[1] in params) return sanitizeInline(params[m[1]]);
    return "";
  });
  return sanitizeInline(out, 300);
}

// ---- payload + fire ----

export interface ActionPayload {
  action: string;
  test: boolean;
  company: { slug: string; name: string };
  customer: { customerId: string; email?: string; name?: string };
  params: Record<string, string | number>;
  conversation: { sessionId: string; message: string; answer: string };
  firedAt: string;
}

export type FireStatus = "fired" | "webhook_failed" | "blocked";

export interface FireResult {
  status: FireStatus;
  httpStatus?: number;
  ms: number;
}

export async function fireWebhook(
  config: ActionConfig,
  payload: ActionPayload,
): Promise<FireResult> {
  const t0 = Date.now();
  try {
    await assertPublicUrl(config.url);
  } catch {
    return { status: "blocked", ms: Date.now() - t0 };
  }

  // Serialize ONCE: the signature covers exactly the bytes on the wire.
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "EverDesk-Actions/1.0 (+https://everdesk.allensaji.dev)",
    "x-everdesk-timestamp": timestamp,
    "x-everdesk-signature": `sha256=${signBody(config.signingSecret, timestamp, body)}`,
  };
  if (config.secretHeader) headers[config.secretHeader.name] = config.secretHeader.value;

  const dispatcher = ssrfAgent();
  try {
    const res = await request(config.url, {
      method: "POST",
      headers,
      body,
      dispatcher,
      signal: AbortSignal.timeout(FIRE_TIMEOUT_MS),
    });
    // undici.request never follows redirects: a 3xx lands below as non-2xx.
    // Drain (bounded) so the socket is reusable; the response body is never
    // reflected anywhere.
    await res.body.dump({ limit: MAX_RESPONSE_BYTES }).catch(() => {});
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    return { status: ok ? "fired" : "webhook_failed", httpStatus: res.statusCode, ms: Date.now() - t0 };
  } catch (e) {
    const blocked = e instanceof Error && /blocked address/.test(e.message);
    return { status: blocked ? "blocked" : "webhook_failed", ms: Date.now() - t0 };
  } finally {
    dispatcher.close().catch(() => {});
  }
}
