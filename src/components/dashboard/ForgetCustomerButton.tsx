"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgetCustomerButton({
  slug,
  customerId,
}: {
  slug: string;
  customerId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "working" | "done" | "error">(
    "idle",
  );
  const [deleted, setDeleted] = useState(0);

  const run = async () => {
    setState("working");
    const res = await fetch(`/api/companies/${slug}/customers/${customerId}/forget`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      setDeleted(data.deleted ?? 0);
      setState("done");
      router.refresh();
    } else {
      setState("error");
    }
  };

  return state === "done" ? (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
      Customer forgotten. {deleted} memory item{deleted === 1 ? "" : "s"} hard-deleted
      from the graph. Ask the agent about them - it provably knows nothing.
    </div>
  ) : (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
      <h3 className="text-sm font-semibold text-red-300">Right to be forgotten</h3>
      <p className="mt-1 text-xs text-red-400/80">
        Hard-deletes every memory of this customer from the graph and vector
        store. This cannot be undone.
      </p>
      <div className="mt-3 flex gap-2">
        {state === "confirm" ? (
          <>
            <button
              onClick={run}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
            >
              Yes, forget everything
            </button>
            <button
              onClick={() => setState("idle")}
              className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400"
            >
              Cancel
            </button>
          </>
        ) : state === "working" ? (
          <span className="text-xs text-red-400">Deleting memories...</span>
        ) : (
          <button
            onClick={() => setState("confirm")}
            className="rounded-lg border border-red-500/30 bg-[#0d0d18] px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10"
          >
            Forget this customer
          </button>
        )}
        {state === "error" ? <p className="text-xs text-red-400">Failed - try again.</p> : null}
      </div>
    </div>
  );
}
