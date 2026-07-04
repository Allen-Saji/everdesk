import { notFound } from "next/navigation";
import { getCompany } from "@/lib/companies";
import { fireCounts, listActions, toPublic } from "@/lib/actions";
import ActionsPanel from "@/components/dashboard/ActionsPanel";

export default async function ActionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) notFound();

  const configs = await listActions(slug);
  const counts = await fireCounts(slug, configs.map((a) => a.id));
  const actions = configs.map((a) => toPublic(a, counts[a.id] ?? 0));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Actions</h1>
        <p className="text-sm text-slate-500">
          Let the agent do things, not just say things: file tickets, ping your
          team, hit your API. Fired actions are written into the customer&apos;s
          memory, so the agent remembers what it did for them.
        </p>
      </div>
      <ActionsPanel slug={slug} initialActions={actions} />
    </div>
  );
}
