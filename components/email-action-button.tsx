"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export function EmailActionButton({
  endpoint,
  kind,
  label,
  defaultRecipient,
}: {
  endpoint: string;
  kind: string;
  label: string;
  defaultRecipient?: string | null;
}) {
  const [recipient, setRecipient] = useState(defaultRecipient || "");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setMessage(null);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, recipient: recipient || null }),
    });
    const data = await response.json();
    setSending(false);
    setMessage(response.ok ? "Email sent and logged." : data.error || data.errorMessage || data.error || "Email was not sent.");
  }

  return (
    <details className="rounded-md border border-slate-200 bg-white p-3">
      <summary className="min-h-11 cursor-pointer list-none text-sm font-semibold text-slate-950">{label}</summary>
      <div className="mt-3 grid gap-2">
        <label className="text-sm font-medium text-slate-700">
          Recipient
          <input
            className="mt-1 min-h-12 w-full rounded-md border border-slate-300 px-3 text-base text-slate-950 sm:text-sm"
            type="email"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="name@example.com"
          />
        </label>
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          <Mail size={15} />
          {sending ? "Sending..." : "Send email"}
        </button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </div>
    </details>
  );
}
