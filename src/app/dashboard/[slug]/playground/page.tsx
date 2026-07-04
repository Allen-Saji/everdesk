import { notFound } from "next/navigation";
import { getCompany } from "@/lib/companies";
import Chat from "@/components/widget/Chat";

export default async function PlaygroundPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">Playground</h1>
      <p className="mb-6 text-sm text-slate-500">
        Exactly what your customers get in the widget - same agent, same memory.
      </p>
      <div className="h-[640px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <Chat companyKey={company.publicKey} />
      </div>
    </div>
  );
}
