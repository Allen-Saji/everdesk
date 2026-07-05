// Auth-aware nav control. Reads the session and renders one of two shapes.
//
// variant "nav" (marketing header): the primary CTA swaps with auth state -
// "Get started" when signed out, "Dashboard" when signed in - and identity /
// sign out collapse into the avatar menu, so the nav never stacks competing
// buttons.
//
// variant "menu" (onboarding, dashboard mobile bar): just the avatar menu.
//
// Reads the session cookie, so any embedding page renders dynamically.

import Link from "next/link";
import { auth } from "@/auth";
import UserMenu from "./UserMenu";

const CTA =
  "rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.35)] hover:bg-indigo-400";

export default async function AuthControl({
  theme = "dark",
  variant = "nav",
}: {
  theme?: "dark" | "light";
  variant?: "nav" | "menu";
}) {
  const session = await auth();
  const user = session?.user;
  const ghost =
    theme === "dark" ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900";

  if (variant === "menu") {
    return user ? <UserMenu name={user.name ?? ""} email={user.email ?? ""} theme={theme} /> : null;
  }

  if (!user) {
    return (
      <>
        <Link href="/signin" className={`text-sm ${ghost}`}>
          Sign in
        </Link>
        <Link href="/onboarding" className={CTA}>
          Get started
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/dashboard" className={CTA}>
        Dashboard
      </Link>
      <UserMenu name={user.name ?? ""} email={user.email ?? ""} theme={theme} />
    </>
  );
}
