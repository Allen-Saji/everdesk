import Link from "next/link";
import { listSessions, sessionStats } from "@/lib/cognee";
import { listCustomers } from "@/lib/companies";
import { recentEvents } from "@/lib/events";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d18] p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [stats, sessions, customers, events] = await Promise.all([
    sessionStats("30d").catch(() => null),
    listSessions({ limit: 200 }).catch(() => null),
    listCustomers(slug),
    recentEvents(slug, 8),
  ]);

  const companySessions =
    sessions?.sessions.filter((s) => s.session_id.startsWith(`everdesk-${slug}-`)) ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">Overview</h1>
      <p className="mb-6 text-sm text-slate-400">
        Your support agent at a glance.
      </p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Conversations" value={String(companySessions.length)} hint="last 200 sessions" />
        <Stat label="Known customers" value={String(customers.length)} />
        <Stat
          label="Workspace spend"
          value={`$${Number(stats?.total_spend_usd ?? 0).toFixed(4)}`}
          hint="Cognee, 30d"
        />
        <Stat
          label="Tokens processed"
          value={String(stats?.tokens_total ?? 0)}
          hint="Cognee, 30d"
        />
      </div>

      <h2 className="mb-3 mt-10 text-sm font-semibold text-slate-200">Latest memory activity</h2>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0d18]">
        {events.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            No activity yet. Train your agent, then chat with it.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 font-mono text-[11px] text-indigo-300">
                  {e.type}
                </span>
                <span className="truncate text-slate-300">{e.label}</span>
                <span className="ml-auto shrink-0 text-xs text-slate-500">
                  {new Date(e.ts).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-4 text-sm text-slate-400">
        Watch it live in the{" "}
        <Link href={`/dashboard/${slug}/memory-feed`} className="font-medium text-indigo-400">
          memory feed
        </Link>
        .
      </p>
    </div>
  );
}
