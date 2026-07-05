"use client";

import { useState } from "react";

function ClipboardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div>
      {label ? (
        <p className="mb-1.5 text-xs font-medium text-slate-300">{label}</p>
      ) : null}
      <div className="relative">
        <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 pr-14 text-xs leading-relaxed text-slate-100">
          <code>{code}</code>
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          title={copied ? "Copied" : "Copy"}
          className={`absolute right-2.5 top-2.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition ${
            copied
              ? "border-emerald-400/40 bg-slate-800 text-emerald-400"
              : "border-white/10 bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-white"
          }`}
        >
          {copied ? <CheckIcon /> : <ClipboardIcon />}
        </button>
      </div>
    </div>
  );
}
