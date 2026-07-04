import Link from "next/link";
import { getCustomer } from "@/lib/companies";
import CustomerGraph from "@/components/dashboard/CustomerGraph";
import ForgetCustomerButton from "@/components/dashboard/ForgetCustomerButton";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const customer = await getCustomer(slug, id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href={`/dashboard/${slug}/customers`} className="text-xs text-indigo-600">
          &larr; All customers
        </Link>
        <h1 className="mt-2 text-xl font-semibold">
          {customer?.email ?? "Forgotten customer"}
        </h1>
        <p className="font-mono text-xs text-slate-400">{id}</p>
      </div>

      <CustomerGraph slug={slug} customerId={id} />

      <ForgetCustomerButton slug={slug} customerId={id} />
    </div>
  );
}
