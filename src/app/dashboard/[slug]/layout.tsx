import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/companies";

const NAV = [
  { href: "", label: "Overview" },
  { href: "/training", label: "Training" },
  { href: "/playground", label: "Playground" },
  { href: "/actions", label: "Actions" },
  { href: "/conversations", label: "Conversations" },
  { href: "/customers", label: "Customers" },
  { href: "/memory-feed", label: "Memory Feed" },
  { href: "/settings", label: "Settings" },
];

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) notFound();

  return (
    <div className="flex min-h-dvh bg-slate-50 text-slate-900">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 sm:flex">
        <Link href="/" className="mb-1 px-2 text-lg font-bold tracking-tight">
          Ever<span className="text-indigo-600">Desk</span>
        </Link>
        <p className="mb-6 px-2 text-xs text-slate-500">{company.name}</p>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={`/dashboard/${slug}${item.href}`}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Memory by Cognee Cloud
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 sm:p-8">{children}</main>
    </div>
  );
}
