import { notFound } from "next/navigation";
import { getCompany } from "@/lib/companies";
import { getRole, listMembers } from "@/lib/members";
import { auth } from "@/auth";
import CopyBlock from "@/components/dashboard/CopyBlock";
import MembersPanel from "@/components/dashboard/MembersPanel";
import { headers } from "next/headers";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) notFound();

  const session = await auth();
  const email = session?.user?.email ?? "";
  const [members, role] = await Promise.all([listMembers(slug), getRole(slug, email)]);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "everdesk.allensaji.dev";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const snippet = `<script src="${origin}/embed.js" data-everdesk-key="${company.publicKey}" async></script>`;
  const apiExample = `curl -X POST ${origin}/api/v1/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "key": "${company.publicKey}",
    "visitorId": "user-123",
    "email": "customer@example.com",
    "message": "How do refunds work?"
  }'`;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500">Install the agent anywhere.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Website widget</h2>
        <p className="mb-4 mt-1 text-xs text-slate-500">
          One script tag, before the closing body tag. That is the whole install.
        </p>
        <CopyBlock code={snippet} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">API access</h2>
        <p className="mb-4 mt-1 text-xs text-slate-500">
          Wire the same agent into your product, mobile app, or internal tools.
          Full reference in the docs.
        </p>
        <CopyBlock code={apiExample} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Company</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Public key</dt>
            <dd className="font-mono text-xs">{company.publicKey}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Knowledge dataset</dt>
            <dd className="font-mono text-xs">{company.kbDataset}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Memory dataset</dt>
            <dd className="font-mono text-xs">{company.memoryDataset}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Agent connection</dt>
            <dd className="font-mono text-xs">{company.agentConnectionId ?? "n/a"}</dd>
          </div>
        </dl>
      </section>

      <MembersPanel
        slug={slug}
        initialMembers={members}
        you={email}
        isOwner={role === "owner"}
      />
    </div>
  );
}
