"use client";

import { useEffect, useRef, useState } from "react";

type Status = { kb: string; memory: string; training: boolean };

export default function TrainingPanel({ slug }: { slug: string }) {
  const [text, setText] = useState("");
  const [urls, setUrls] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshStatus = async () => {
    const res = await fetch(`/api/companies/${slug}/train`);
    if (res.ok) {
      const s: Status = await res.json();
      setStatus(s);
      return s;
    }
    return null;
  };

  useEffect(() => {
    refreshStatus();
    return () => {
      if (polling.current) clearInterval(polling.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const startPolling = () => {
    if (polling.current) clearInterval(polling.current);
    polling.current = setInterval(async () => {
      const s = await refreshStatus();
      if (s && !s.training && polling.current) {
        clearInterval(polling.current);
        polling.current = null;
        setMessage("Training complete. Your agent knows this now - try the playground.");
      }
    }, 4000);
  };

  const submit = async () => {
    setMessage(null);
    setSubmitting(true);
    try {
      let res: Response;
      if (files.length) {
        const form = new FormData();
        for (const f of files) form.append("files", f);
        res = await fetch(`/api/companies/${slug}/train`, { method: "POST", body: form });
      } else {
        const body = {
          texts: text.trim() ? [text.trim()] : [],
          urls: urls
            .split("\n")
            .map((u) => u.trim())
            .filter(Boolean),
        };
        if (!body.texts.length && !body.urls.length) {
          setMessage("Paste some text, add URLs, or choose files first.");
          return;
        }
        res = await fetch(`/api/companies/${slug}/train`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "training failed");
      setText("");
      setUrls("");
      setFiles([]);
      setMessage("Building the knowledge graph...");
      startPolling();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Training failed");
    } finally {
      setSubmitting(false);
    }
  };

  const kbState = status?.training
    ? { label: "Building knowledge graph...", cls: "bg-amber-500/10 text-amber-400" }
    : status?.kb === "DATASET_PROCESSING_COMPLETED"
      ? { label: "Knowledge graph ready", cls: "bg-emerald-500/10 text-emerald-400" }
      : { label: "Not trained yet", cls: "bg-white/5 text-slate-400" };

  return (
    <div className="space-y-6">
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${kbState.cls}`}>
        {status?.training ? (
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-current opacity-60" />
        )}
        {kbState.label}
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0d0d18] p-5">
        <h3 className="text-sm font-semibold">Paste documentation</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Paste product docs, FAQs, policies..."
          className="mt-3 w-full rounded-lg border border-white/10 p-3 text-sm bg-white/5 text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-400"
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0d0d18] p-5">
        <h3 className="text-sm font-semibold">Add page URLs</h3>
        <p className="mt-1 text-xs text-slate-400">One per line. We fetch and learn each page.</p>
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={3}
          placeholder={"https://yourproduct.com/docs\nhttps://yourproduct.com/faq"}
          className="mt-3 w-full rounded-lg border border-white/10 p-3 font-mono text-xs bg-white/5 text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-400"
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0d0d18] p-5">
        <h3 className="text-sm font-semibold">Upload files</h3>
        <p className="mt-1 text-xs text-slate-400">PDF, Markdown, TXT, DOCX.</p>
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="mt-3 block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-300"
        />
        {files.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">{files.map((f) => f.name).join(", ")}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={submit}
          disabled={submitting || status?.training}
          className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 disabled:opacity-50"
        >
          {submitting ? "Uploading..." : "Train agent"}
        </button>
        {message ? <p className="text-sm text-slate-300">{message}</p> : null}
      </div>
    </div>
  );
}
