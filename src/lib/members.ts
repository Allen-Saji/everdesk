// Team access model. Each company has a member set stored as a Redis hash
// `members:<slug>` = { <email>: "owner" | "member" }. A reverse index
// `user:<email>:companies` (a set of slugs) lets us list the companies a signed
// -in user belongs to without scanning. Emails are the identity key: inviting a
// teammate allowlists their email, and they gain access the moment they sign in
// with that Google account.

import { kv } from "./kv";

export type Role = "owner" | "member";

const membersKey = (slug: string) => `members:${slug}`;
const userCompaniesKey = (email: string) => `user:${normalizeEmail(email)}:companies`;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function addMember(slug: string, email: string, role: Role): Promise<void> {
  const e = normalizeEmail(email);
  await Promise.all([
    kv().hset(membersKey(slug), { [e]: role }),
    kv().sadd(userCompaniesKey(e), slug),
  ]);
}

export async function removeMember(slug: string, email: string): Promise<void> {
  const e = normalizeEmail(email);
  await Promise.all([
    kv().hdel(membersKey(slug), e),
    kv().srem(userCompaniesKey(e), slug),
  ]);
}

export async function getRole(slug: string, email: string): Promise<Role | null> {
  const role = await kv().hget<Role>(membersKey(slug), normalizeEmail(email));
  return role ?? null;
}

export async function isMember(slug: string, email: string): Promise<boolean> {
  return (await getRole(slug, email)) !== null;
}

export interface Member {
  email: string;
  role: Role;
}

export async function listMembers(slug: string): Promise<Member[]> {
  const map = (await kv().hgetall<Record<string, Role>>(membersKey(slug))) ?? {};
  return Object.entries(map)
    .map(([email, role]) => ({ email, role }))
    .sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === "owner" ? -1 : 1));
}

export async function listUserCompanies(email: string): Promise<string[]> {
  return (await kv().smembers(userCompaniesKey(normalizeEmail(email)))) ?? [];
}
