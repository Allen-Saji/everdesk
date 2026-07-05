import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listUserCompanies } from "@/lib/members";
import { Company, getCompany } from "@/lib/companies";

export const metadata = { title: "Your companies - EverDesk" };

export default async function DashboardIndex() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=/dashboard");

  const slugs = await listUserCompanies(email);
  if (slugs.length === 0) redirect("/onboarding");
  if (slugs.length === 1) redirect(`/dashboard/${slugs[0]}`);

  const rows = await Promise.all(slugs.map((s) => getCompany(s)));
  const companies = rows.filter((c): c is Company => !!c);

  return (
    <div className="min-h-dvh bg-[#07070d] px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Your companies</h1>
            <p className="mt-1 text-sm text-slate-400">Pick a workspace or create a new one.</p>
          </div>
          <p className="text-xs text-slate-500">{email}</p>
        </div>
        <div className="mt-6 space-y-2">
          {companies.map((c) => (
            <Link
              key={c.slug}
              href={`/dashboard/${c.slug}`}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0d0d18] px-5 py-4 hover:border-indigo-300"
            >
              <span className="font-medium">{c.name}</span>
              <span className="font-mono text-xs text-slate-500">{c.slug}</span>
            </Link>
          ))}
        </div>
        <Link
          href="/onboarding"
          className="mt-6 inline-block rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          + New company
        </Link>
      </div>
    </div>
  );
}
