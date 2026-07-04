import { Redis } from "@upstash/redis";
import { env } from "./env";

let client: Redis | null = null;

export function kv(): Redis {
  if (!client) client = new Redis({ url: env.kvUrl, token: env.kvToken });
  return client;
}
