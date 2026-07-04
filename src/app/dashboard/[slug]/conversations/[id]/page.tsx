import Link from "next/link";
import { sessionDetail } from "@/lib/cognee";
import FeedbackButtons from "@/components/dashboard/FeedbackButtons";
import ResolveForm from "@/components/dashboard/ResolveForm";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const sessionId = decodeURIComponent(id);
  const session = await sessionDetail(sessionId).catch(() => null);

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-slate-500">Conversation not found.</p>
      </div>
    );
  }

  const qas = session.qas ?? [];
  const last = qas[qas.length - 1];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/${slug}/conversations`} className="text-xs text-indigo-600">
        &larr; All conversations
      </Link>
      <h1 className="mt-2 text-xl font-semibold">{session.label ?? sessionId}</h1>
      <p className="mb-6 text-xs text-slate-400">
        {new Date(session.started_at).toLocaleString()} - {qas.length} turns - $
        {Number(session.cost_usd ?? 0).toFixed(4)}
      </p>

      <div className="space-y-4">
        {qas.map((qa) => (
          <div key={qa.qa_id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-800">{qa.question}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{qa.answer}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {new Date(qa.time).toLocaleTimeString()}
              </span>
              {qa.feedback_score != null ? (
                <span className="text-xs text-slate-400">
                  feedback: {qa.feedback_score}
                </span>
              ) : (
                <FeedbackButtons slug={slug} sessionId={sessionId} qaId={qa.qa_id} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <ResolveForm
          slug={slug}
          defaultProblem={last?.question ?? ""}
          defaultSolution={last?.answer ?? ""}
        />
      </div>
    </div>
  );
}
