import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getCompany } from "@/lib/companies";
import { isMember } from "@/lib/members";

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
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=/dashboard/${slug}`);

  const company = await getCompany(slug);
  if (!company) notFound();
  // Non-members get a 404, not a 403: the workspace's existence is not disclosed.
  if (!(await isMember(slug, email))) notFound();

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
        <div className="mt-auto space-y-2">
          <Link
            href="/dashboard"
            className="block px-3 text-xs text-slate-500 hover:text-indigo-700"
          >
            All companies
          </Link>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <p className="truncate" title={email}>
              {email}
            </p>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="mt-1 text-slate-600 hover:text-indigo-700">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:hidden">
          <Link href={`/dashboard/${slug}`} className="text-base font-bold tracking-tight">
            Ever<span className="text-indigo-600">Desk</span>
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="text-sm font-medium text-slate-600 hover:text-indigo-700"
            >
              Sign out
            </button>
          </form>
        </header>
        <main className="min-w-0 flex-1 p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
