"use client";

// Actions tab: list, create, toggle, test-fire and delete webhook actions.
// Secrets are write-only from here; the signing secret is shown exactly once
// after creation.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionConfigPublic, ActionParam } from "@/lib/actions";
import CopyBlock from "./CopyBlock";

const inputCls =
  "mt-1 w-full rounded-lg border border-white/10 p-2.5 text-sm bg-white/5 text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-400";
const labelCls = "mt-3 block text-xs font-medium text-slate-300";

const EMPTY_PARAM: ActionParam = { key: "", type: "string", required: true, description: "" };

export default function ActionsPanel({
  slug,
  initialActions,
}: {
  slug: string;
  initialActions: ActionConfigPublic[];
}) {
  const router = useRouter();
  const [actions, setActions] = useState(initialActions);
  const [showForm, setShowForm] = useState(initialActions.length === 0);
  const [secretOnce, setSecretOnce] = useState<{ name: string; secret: string } | null>(null);

  return (
    <div className="space-y-6">
      {secretOnce ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-300">
            Signing secret for {secretOnce.name} - copy it now
          </p>
          <p className="mb-3 mt-1 text-xs text-amber-400">
            This is shown only once. Your webhook receiver uses it to verify that
            payloads really come from EverDesk (see the docs for the verification snippet).
          </p>
          <CopyBlock code={secretOnce.secret} />
          <button
            onClick={() => setSecretOnce(null)}
            className="mt-3 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            I saved it
          </button>
        </div>
      ) : null}

      {actions.map((a) => (
        <ActionCard
          key={a.id}
          slug={slug}
          action={a}
          onChange={(next) =>
            setActions((prev) =>
              next === null ? prev.filter((x) => x.id !== a.id) : prev.map((x) => (x.id === a.id ? next : x)),
            )
          }
        />
      ))}

      {showForm ? (
        <CreateForm
          slug={slug}
          onCreated={(action, secret) => {
            setActions((prev) => [...prev, action]);
            setSecretOnce({ name: action.name, secret });
            setShowForm(false);
            router.refresh();
          }}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          New action
        </button>
      )}
    </div>
  );
}

function ActionCard({
  slug,
  action,
  onChange,
}: {
  slug: string;
  action: ActionConfigPublic;
  onChange: (next: ActionConfigPublic | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch(`/api/companies/${slug}/actions/${action.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) onChange((await res.json()).action);
    setBusy(false);
  };

  const testFire = async () => {
    setBusy(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/companies/${slug}/actions/${action.id}/test`, {
        method: "POST",
      });
      const data = await res.json();
      setTestResult(
        res.ok
          ? data.status === "fired"
            ? `Delivered (HTTP ${data.httpStatus})`
            : `Failed: ${data.status}${data.httpStatus ? ` (HTTP ${data.httpStatus})` : ""}`
          : data.error ?? "Test failed",
      );
    } catch {
      setTestResult("Test failed");
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!confirm(`Delete action "${action.name}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/companies/${slug}/actions/${action.id}`, { method: "DELETE" });
    if (res.ok) onChange(null);
    else setBusy(false);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d18] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm font-semibold">{action.name}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            action.enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-slate-400"
          }`}
        >
          {action.enabled ? "live" : "off"}
        </span>
        <span className="text-xs text-slate-500">
          {action.fireCount} fire{action.fireCount === 1 ? "" : "s"}
        </span>
        <span className="ml-auto text-xs text-slate-500">{new URL(action.url).hostname}</span>
      </div>
      <p className="mt-2 text-sm text-slate-300">{action.description}</p>
      {action.params.length ? (
        <p className="mt-1 text-xs text-slate-400">
          Collects: {action.params.map((p) => p.key + (p.required ? "*" : "")).join(", ")}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => patch({ enabled: !action.enabled })}
          disabled={busy}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
            action.enabled
              ? "bg-white/5 text-slate-200 hover:bg-white/10"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {action.enabled ? "Disable" : "Enable"}
        </button>
        <button
          onClick={testFire}
          disabled={busy}
          className="rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50"
        >
          Test fire
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          Delete
        </button>
        {testResult ? (
          <span
            className={`text-xs ${testResult.startsWith("Delivered") ? "text-emerald-400" : "text-red-400"}`}
          >
            {testResult}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CreateForm({
  slug,
  onCreated,
}: {
  slug: string;
  onCreated: (action: ActionConfigPublic, signingSecret: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [params, setParams] = useState<ActionParam[]>([]);
  const [headerName, setHeaderName] = useState("");
  const [headerValue, setHeaderValue] = useState("");
  const [receipt, setReceipt] = useState("");
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const setParam = (i: number, patch: Partial<ActionParam>) =>
    setParams((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const submit = async () => {
    setState("saving");
    setError(null);
    try {
      const res = await fetch(`/api/companies/${slug}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          url: url.trim(),
          params: params.filter((p) => p.key.trim()),
          secretHeader:
            headerName.trim() && headerValue.trim()
              ? { name: headerName.trim(), value: headerValue.trim() }
              : undefined,
          receiptTemplate: receipt.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create action");
        setState("idle");
        return;
      }
      onCreated(data.action, data.signingSecretOnce);
    } catch {
      setError("Could not create action");
      setState("idle");
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d18] p-5">
      <h3 className="text-sm font-semibold">New action</h3>
      <p className="mt-1 text-xs text-slate-400">
        The agent fires this automatically when a conversation matches your trigger.
        Point it at your own endpoint, or at Zapier / Make / n8n to reach email, Slack,
        CRMs and everything else.
      </p>

      <label className={labelCls}>Action name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="create_refund_ticket"
        className={`${inputCls} font-mono`}
      />

      <label className={labelCls}>When should this fire?</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="When a customer asks for a refund or reports a billing problem"
        className={inputCls}
      />

      <label className={labelCls}>Information the agent must collect</label>
      <div className="mt-1 space-y-2">
        {params.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              value={p.key}
              onChange={(e) => setParam(i, { key: e.target.value })}
              placeholder="order_id"
              className="w-36 rounded-lg border border-white/10 p-2 font-mono text-xs bg-white/5 text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-400"
            />
            <select
              value={p.type}
              onChange={(e) => setParam(i, { type: e.target.value as "string" | "number" })}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-200 outline-none"
            >
              <option value="string">text</option>
              <option value="number">number</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={p.required}
                onChange={(e) => setParam(i, { required: e.target.checked })}
              />
              required
            </label>
            <input
              value={p.description}
              onChange={(e) => setParam(i, { description: e.target.value })}
              placeholder="The order number, e.g. 4711"
              className="min-w-40 flex-1 rounded-lg border border-white/10 p-2 text-xs bg-white/5 text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-400"
            />
            <button
              onClick={() => setParams((prev) => prev.filter((_, j) => j !== i))}
              className="text-xs text-red-400 hover:text-red-300"
            >
              remove
            </button>
          </div>
        ))}
        {params.length < 10 ? (
          <button
            onClick={() => setParams((prev) => [...prev, { ...EMPTY_PARAM }])}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
          >
            Add field
          </button>
        ) : null}
      </div>

      <label className={labelCls}>Webhook URL</label>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://hooks.zapier.com/hooks/catch/..."
        className={`${inputCls} font-mono`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Secret header (optional)</label>
          <input
            value={headerName}
            onChange={(e) => setHeaderName(e.target.value)}
            placeholder="X-Api-Key"
            className={`${inputCls} font-mono`}
          />
        </div>
        <div>
          <label className={labelCls}>Header value</label>
          <input
            value={headerValue}
            onChange={(e) => setHeaderValue(e.target.value)}
            type="password"
            placeholder="stored server-side only"
            className={`${inputCls} font-mono`}
          />
        </div>
      </div>

      <label className={labelCls}>Reply to the customer after firing (optional)</label>
      <input
        value={receipt}
        onChange={(e) => setReceipt(e.target.value)}
        placeholder="Filed your refund for order {{params.order_id}} - the team is on it."
        className={inputCls}
      />

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={state === "saving" || !name.trim() || !description.trim() || !url.trim()}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {state === "saving" ? "Creating..." : "Create action"}
        </button>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
