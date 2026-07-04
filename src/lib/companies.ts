import { randomBytes, createHash } from "node:crypto";
import { kv } from "./kv";
import { createDataset, registerAgent } from "./cognee";

export interface Company {
  slug: string;
  name: string;
  siteUrl?: string;
  publicKey: string;
  kbDataset: string;
  kbId: string;
  memoryDataset: string;
  memoryId: string;
  agentConnectionId?: string;
  persona?: string;
  createdAt: string;
}

export interface Visitor {
  customerId: string;
  visitorId: string;
  email?: string;
  name?: string;
  firstSeen: string;
  lastSeen: string;
}

const companyKey = (slug: string) => `company:${slug}`;
const pkKey = (publicKey: string) => `company:pk:${publicKey}`;
const visitorKey = (slug: string, visitorId: string) => `visitor:${slug}:${visitorId}`;
const customerKey = (slug: string, customerId: string) => `customer:${slug}:${customerId}`;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export async function getCompany(slug: string): Promise<Company | null> {
  return (await kv().get<Company>(companyKey(slug))) ?? null;
}

export async function getCompanyByKey(publicKey: string): Promise<Company | null> {
  const slug = await kv().get<string>(pkKey(publicKey));
  return slug ? getCompany(slug) : null;
}

export async function listCompanies(): Promise<Company[]> {
  const slugs = await kv().smembers("companies");
  if (!slugs.length) return [];
  const rows = await Promise.all(slugs.map((s) => getCompany(s)));
  return rows.filter((c): c is Company => !!c);
}

/**
 * Idempotent provisioning: Cognee datasets are idempotent by name, and an
 * existing company record keeps its public key across re-runs.
 */
export async function provisionCompany(input: {
  name: string;
  siteUrl?: string;
  persona?: string;
}): Promise<{ company: Company; created: boolean }> {
  const slug = slugify(input.name);
  if (!slug) throw new Error("Company name produces an empty slug");
  const existing = await getCompany(slug);

  const kbDataset = `everdesk-${slug}-kb`;
  const memoryDataset = `everdesk-${slug}-memory`;
  const [kb, memory] = await Promise.all([
    createDataset(kbDataset),
    createDataset(memoryDataset),
  ]);

  let agentConnectionId = existing?.agentConnectionId;
  if (!agentConnectionId) {
    try {
      const agent = await registerAgent({
        name: `everdesk-${slug}-support-agent`,
        datasetNames: [kbDataset, memoryDataset],
        metadata: { product: "everdesk", company: slug },
      });
      agentConnectionId = agent.id;
    } catch {
      // Agent registration is a visibility feature, never load-bearing.
    }
  }

  const company: Company = {
    slug,
    name: input.name,
    siteUrl: input.siteUrl ?? existing?.siteUrl,
    publicKey: existing?.publicKey ?? `pk_${slug}_${randomBytes(12).toString("hex")}`,
    kbDataset,
    kbId: kb.id,
    memoryDataset,
    memoryId: memory.id,
    agentConnectionId,
    persona: input.persona ?? existing?.persona,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  await Promise.all([
    kv().set(companyKey(slug), company),
    kv().set(pkKey(company.publicKey), slug),
    kv().sadd("companies", slug),
  ]);

  return { company, created: !existing };
}

export function customerIdFor(visitorId: string, email?: string): string {
  const basis = email?.trim().toLowerCase() || visitorId;
  return `cust_${createHash("sha256").update(basis).digest("hex").slice(0, 8)}`;
}

export async function upsertVisitor(
  slug: string,
  visitorId: string,
  email?: string,
  name?: string,
): Promise<Visitor> {
  const key = visitorKey(slug, visitorId);
  const now = new Date().toISOString();
  const existing = await kv().get<Visitor>(key);
  const visitor: Visitor = {
    customerId: customerIdFor(visitorId, email ?? existing?.email),
    visitorId,
    email: email ?? existing?.email,
    name: name ?? existing?.name,
    firstSeen: existing?.firstSeen ?? now,
    lastSeen: now,
  };
  await Promise.all([
    kv().set(key, visitor),
    kv().set(customerKey(slug, visitor.customerId), visitor),
    kv().sadd(`customers:${slug}`, visitor.customerId),
  ]);
  return visitor;
}

export async function getCustomer(slug: string, customerId: string): Promise<Visitor | null> {
  return (await kv().get<Visitor>(customerKey(slug, customerId))) ?? null;
}

export async function listCustomers(slug: string): Promise<Visitor[]> {
  const ids = await kv().smembers(`customers:${slug}`);
  if (!ids.length) return [];
  const rows = await Promise.all(ids.map((id) => getCustomer(slug, id)));
  return rows.filter((v): v is Visitor => !!v);
}
