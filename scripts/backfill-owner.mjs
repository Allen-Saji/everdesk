// One-time migration for the auth layer: companies provisioned before member
// records existed have no owner, which would lock everyone out. This adds an
// email as owner of existing companies. Uses the same @upstash/redis client as
// the app so hash/set serialization matches exactly.
//
// Usage:
//   node scripts/backfill-owner.mjs you@example.com            # all companies
//   node scripts/backfill-owner.mjs you@example.com acme       # one slug
//
// Idempotent and additive: it never removes an existing owner.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  const p = resolve(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const email = (process.argv[2] || "").trim().toLowerCase();
const onlySlug = process.argv[3];
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("usage: node scripts/backfill-owner.mjs <email> [slug]");
  process.exit(1);
}

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const slugs = onlySlug ? [onlySlug] : (await redis.smembers("companies")) ?? [];
if (!slugs.length) {
  console.log("no companies found");
  process.exit(0);
}

for (const slug of slugs) {
  await redis.hset(`members:${slug}`, { [email]: "owner" });
  await redis.sadd(`user:${email}:companies`, slug);
  console.log(`owner ${email} -> ${slug}`);
}
console.log(`done: ${slugs.length} company(ies)`);
