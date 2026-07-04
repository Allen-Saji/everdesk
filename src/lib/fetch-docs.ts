// Server-side URL fetching for training. Cognee's /add on this tenant only
// accepts file uploads (findings #18), so we fetch pages ourselves, extract
// readable text, and ingest via add_text.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    return (
      v6 === "::1" ||
      v6.startsWith("fe80:") ||
      v6.startsWith("fc") ||
      v6.startsWith("fd") ||
      v6.startsWith("::ffff:127.") ||
      v6.startsWith("::ffff:10.") ||
      v6.startsWith("::ffff:192.168.")
    );
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 127 ||
    a === 10 ||
    a === 0 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  );
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error(`Refusing to fetch internal host: ${host}`);
  }
  const ips = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  for (const { address } of ips) {
    if (isPrivateIp(address)) {
      throw new Error(`Refusing to fetch private address for host: ${host}`);
    }
  }
}

export function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<(script|style|noscript|svg|nav|footer)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const text = withoutBlocks
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

/** Fetch a user-supplied docs URL and return readable text for ingestion. */
export async function fetchUrlAsText(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Only http(s) URLs are supported: ${rawUrl}`);
  }
  await assertPublicHost(url);

  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "EverDeskBot/1.0 (+https://everdesk.allensaji.dev)" },
  });
  if (!res.ok) {
    throw new Error(`Could not fetch ${rawUrl} (HTTP ${res.status})`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!/text\/|application\/(xhtml|xml|json|markdown)/.test(contentType)) {
    throw new Error(`Unsupported content type at ${rawUrl}: ${contentType || "unknown"}`);
  }
  const raw = await res.text();
  if (raw.length > MAX_BYTES) {
    throw new Error(`Page too large at ${rawUrl} (over 2MB)`);
  }

  const text = contentType.includes("html") ? htmlToText(raw) : raw.trim();
  if (text.length < 80) {
    throw new Error(
      `No readable text found at ${rawUrl} - if the page renders via JavaScript, paste the docs as text instead`,
    );
  }
  return `Documentation from ${rawUrl}:\n\n${text}`;
}
