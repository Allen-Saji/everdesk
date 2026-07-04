import TrainingPanel from "@/components/dashboard/TrainingPanel";

export default async function TrainingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">Training</h1>
      <p className="mb-6 text-sm text-slate-500">
        Give your agent whatever you have: pasted docs, page URLs, or files. It
        builds a knowledge graph, not just embeddings.
      </p>
      <TrainingPanel slug={slug} />
    </div>
  );
}
