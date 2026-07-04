import Link from "next/link";
import { listSessions } from "@/lib/cognee";

export default async function ConversationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { sessions } = await listSessions({ limit: 200 }).catch(() => ({ sessions: [] }));
  const rows = sessions
    .filter((s) => s.session_id.startsWith(`everdesk-${slug}-`))
    .sort((a, b) => (a.last_activity_at < b.last_activity_at ? 1 : -1));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold">Conversations</h1>
      <p className="mb-6 text-sm text-slate-500">
        Every session your agent has handled, straight from Cognee.
      </p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No conversations yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((s) => (
              <li key={s.session_id}>
                <Link
                  href={`/dashboard/${slug}/conversations/${encodeURIComponent(s.session_id)}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {s.label ?? s.session_id}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {new Date(s.started_at).toLocaleString()} - {s.msg_count ?? 0} messages
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      s.effective_status === "completed"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {s.effective_status ?? s.status}
                  </span>
                  <span className="w-20 text-right font-mono text-xs text-slate-400">
                    ${Number(s.cost_usd ?? 0).toFixed(4)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
