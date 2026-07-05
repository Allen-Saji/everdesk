import Link from "next/link";
import { listCustomers } from "@/lib/companies";

export default async function CustomersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const customers = await listCustomers(slug);
  customers.sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold">Customers</h1>
      <p className="mb-6 text-sm text-slate-400">
        Everyone your agent has met - and remembers.
      </p>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0d18]">
        {customers.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No customers yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {customers.map((c) => (
              <li key={c.customerId}>
                <Link
                  href={`/dashboard/${slug}/customers/${c.customerId}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-300">
                    {(c.email ?? c.customerId).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {c.email ?? "Anonymous visitor"}
                    </p>
                    <p className="font-mono text-xs text-slate-500">{c.customerId}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>first seen {new Date(c.firstSeen).toLocaleDateString()}</p>
                    <p>last seen {new Date(c.lastSeen).toLocaleDateString()}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
