// Public chat API: consumed by the EverDesk widget AND by companies embedding
// the agent in their own products (docs: /docs). CORS-open, public-key auth.

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getCompanyByKey, upsertVisitor } from "@/lib/companies";
import { mintSessionId, runChatTurn } from "@/lib/agent";

export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  let body: {
    key?: string;
    visitorId?: string;
    email?: string;
    name?: string;
    sessionId?: string;
    message?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { key, visitorId, email, name, message } = body;
  if (!key) return json({ error: "Missing 'key' (company public key)" }, 401);
  if (!visitorId || !message) {
    return json({ error: "Missing required fields: visitorId, message" }, 400);
  }
  if (message.length > 4000) return json({ error: "Message too long" }, 413);

  const company = await getCompanyByKey(key);
  if (!company) return json({ error: "Unknown public key" }, 401);

  const visitor = await upsertVisitor(company.slug, visitorId, email, name);
  const sessionId =
    body.sessionId && body.sessionId.startsWith(`everdesk-${company.slug}-`)
      ? body.sessionId
      : mintSessionId(company.slug, visitor.customerId);

  try {
    const result = await runChatTurn({
      company,
      visitor,
      sessionId,
      message,
      defer: (task) => after(task),
    });
    return json(result);
  } catch (e) {
    console.error("chat turn failed", e);
    return json({ error: "Agent temporarily unavailable" }, 502);
  }
}
