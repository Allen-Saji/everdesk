import MemoryFeed from "@/components/dashboard/MemoryFeed";

export default async function MemoryFeedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold">Memory feed</h1>
      <p className="mb-6 text-sm text-slate-500">
        Every recall, remember, resolution, and forget - live, as the agent
        thinks.
      </p>
      <MemoryFeed slug={slug} />
    </div>
  );
}
