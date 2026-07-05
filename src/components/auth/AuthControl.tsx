// Reusable sign-in / sign-out control. Server component: reads the session and
// renders "Sign in" when signed out, or the user's name + Dashboard link +
// "Sign out" when signed in. `theme` adapts colors for the dark marketing pages
// vs the light dashboard. Note: because it reads the session cookie, any page
// embedding it is rendered dynamically.

import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function AuthControl({ theme = "dark" }: { theme?: "dark" | "light" }) {
  const session = await auth();
  const dark = theme === "dark";
  const link = dark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-indigo-700";

  if (!session?.user) {
    return (
      <Link href="/signin" className={`text-sm ${link}`}>
        Sign in
      </Link>
    );
  }

  const label = session.user.name || session.user.email || "Account";
  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/dashboard" className={link}>
        Dashboard
      </Link>
      <span
        className={`hidden max-w-[10rem] truncate sm:inline ${dark ? "text-slate-500" : "text-slate-400"}`}
        title={session.user.email ?? undefined}
      >
        {label}
      </span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className={link}>
          Sign out
        </button>
      </form>
    </div>
  );
}
