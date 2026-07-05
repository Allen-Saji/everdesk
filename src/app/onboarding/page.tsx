import Link from "next/link";
import Wizard from "@/components/onboarding/Wizard";
import AuthControl from "@/components/auth/AuthControl";

export const metadata = { title: "Onboard your company" };

export default function OnboardingPage() {
  return (
    <div className="landing min-h-dvh bg-[#07070d] text-slate-300">
      <header className="border-b border-white/5">
        <nav className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            Ever<span className="text-indigo-400">Desk</span>
          </Link>
          <div className="ml-auto">
            <AuthControl theme="dark" />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-xl px-6 py-14">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-indigo-400">
          Onboarding
        </p>
        <h1 className="font-display mt-3 text-4xl text-white">
          Two minutes to a live agent
        </h1>
        <p className="mb-10 mt-3 text-sm leading-relaxed text-slate-400">
          Name your company, hand over whatever docs you have, and we provision
          an agent with its own knowledge graph and customer memory.
        </p>
        <Wizard />
      </main>
    </div>
  );
}
