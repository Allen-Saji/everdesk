"use client";

// Avatar dropdown: the single home for identity and account actions so the nav
// never has to spell out name + sign out inline. Closes on outside-click or
// Escape. The panel is intentionally light on both themes (a standard dropdown
// surface); only the trigger ring adapts to the surrounding nav.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";

export default function UserMenu({
  name,
  email,
  theme = "dark",
}: {
  name: string;
  email: string;
  theme?: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const initial = (name || email || "?").trim().charAt(0).toUpperCase();
  const ring =
    theme === "dark" ? "ring-white/15 hover:ring-white/40" : "ring-slate-200 hover:ring-slate-300";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-sm font-semibold text-white ring-2 transition ${ring}`}
      >
        {initial}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-slate-900">{name || "Signed in"}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
          <div className="py-1">
            <Link
              href="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Dashboard
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
