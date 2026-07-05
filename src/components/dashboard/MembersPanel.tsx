"use client";

import { useState } from "react";
import type { Member } from "@/lib/members";

export default function MembersPanel({
  slug,
  initialMembers,
  you,
  isOwner,
}: {
  slug: string;
  initialMembers: Member[];
  you: string;
  isOwner: boolean;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (method: "POST" | "DELETE", target: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${slug}/members`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMembers(data.members);
      if (method === "POST") setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-white/10 bg-[#0d0d18] p-5">
      <h2 className="text-sm font-semibold">Team</h2>
      <p className="mb-4 mt-1 text-xs text-slate-400">
        {isOwner
          ? "Invite teammates by email. They get access when they sign in with that Google account."
          : "Members with access to this workspace. Only the owner can change the team."}
      </p>
      <ul className="divide-y divide-white/5">
        {members.map((m) => (
          <li key={m.email} className="flex items-center justify-between py-2.5 text-sm">
            <span className="min-w-0 truncate">
              {m.email}
              {m.email === you ? <span className="ml-1 text-xs text-slate-500">(you)</span> : null}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  m.role === "owner" ? "bg-indigo-500/10 text-indigo-300" : "bg-white/5 text-slate-400"
                }`}
              >
                {m.role}
              </span>
              {isOwner && m.role !== "owner" ? (
                <button
                  onClick={() => mutate("DELETE", m.email)}
                  disabled={busy}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                >
                  Remove
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {isOwner ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mutate("POST", email);
          }}
          className="mt-4 flex gap-2"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            required
            className="min-w-0 flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm bg-white/5 text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-400"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-40"
          >
            Invite
          </button>
        </form>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </section>
  );
}
