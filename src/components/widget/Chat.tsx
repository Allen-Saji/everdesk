"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "agent";
  text: string;
}

function getOrCreate(storage: Storage, key: string, make: () => string): string {
  let v = storage.getItem(key);
  if (!v) {
    v = make();
    storage.setItem(key, v);
  }
  return v;
}

export default function Chat({ companyKey }: { companyKey: string }) {
  const [companyName, setCompanyName] = useState<string>("Support");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailDismissed, setEmailDismissed] = useState(false);
  const visitorId = useRef<string>("");
  const sessionId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    visitorId.current = getOrCreate(localStorage, "everdesk_visitor", () =>
      crypto.randomUUID(),
    );
    sessionId.current = sessionStorage.getItem("everdesk_session");
    setEmail(localStorage.getItem("everdesk_email"));
    fetch(`/api/v1/widget-config?key=${encodeURIComponent(companyKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c?.name && setCompanyName(c.name))
      .catch(() => {});
  }, [companyKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || pending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: message }]);
    setPending(true);
    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: companyKey,
          visitorId: visitorId.current,
          email: email ?? undefined,
          sessionId: sessionId.current ?? undefined,
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      sessionId.current = data.sessionId;
      sessionStorage.setItem("everdesk_session", data.sessionId);
      setMessages((m) => [...m, { role: "agent", text: data.answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "agent", text: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setPending(false);
    }
  }, [input, pending, companyKey, email]);

  const saveEmail = () => {
    const v = emailDraft.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return;
    localStorage.setItem("everdesk_email", v);
    setEmail(v);
  };

  return (
    <div className="flex h-dvh flex-col bg-white text-slate-900">
      <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
          {companyName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold">{companyName} Support</p>
          <p className="text-xs text-slate-500">Remembers you. Replies in seconds.</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm">
            Hi! Ask me anything about {companyName}. If we have talked before, I will
            remember.
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] w-fit rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm text-white whitespace-pre-wrap">
              {m.text}
            </div>
          ) : (
            <div key={i} className="max-w-[85%] w-fit rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm whitespace-pre-wrap">
              {m.text}
            </div>
          ),
        )}
        {pending && (
          <div className="w-fit rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
            </span>
          </div>
        )}
      </div>

      {!email && !emailDismissed && (
        <div className="border-t border-slate-100 bg-indigo-50/60 px-4 py-2.5">
          <p className="mb-1.5 text-xs text-slate-600">
            Add your email so I can remember you across visits:
          </p>
          <div className="flex gap-2">
            <input
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveEmail()}
              placeholder="you@company.com"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
              type="email"
            />
            <button onClick={saveEmail} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
              Save
            </button>
            <button onClick={() => setEmailDismissed(true)} className="text-xs text-slate-400" aria-label="Dismiss">
              Skip
            </button>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Type your question..."
            className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400"
          />
          <button
            onClick={send}
            disabled={pending || !input.trim()}
            aria-label="Send"
            className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-indigo-600 text-white disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-400">
          Powered by <span className="font-semibold text-slate-500">EverDesk</span> - support that never forgets
        </p>
      </footer>
    </div>
  );
}
