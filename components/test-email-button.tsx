"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export function TestEmailButton() {
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendTest() {
    setSending(true);
    setMessage(null);
    const response = await fetch("/api/email/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient }),
    });
    const data = await response.json();
    setSending(false);
    setMessage(response.ok ? "Test email sent and logged." : data.error || "Test email was not sent.");
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <label className="text-sm font-medium text-slate-700">
        Test recipient
        <input
          className="mt-1 min-h-12 w-full rounded-md border border-slate-300 px-3 text-base text-slate-950 sm:text-sm"
          type="email"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          placeholder="it@example.com"
        />
      </label>
      <button
        type="button"
        onClick={sendTest}
        disabled={sending || !recipient}
        className="inline-flex min-h-12 items-center justify-center gap-2 self-end rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        <Send size={15} />
        {sending ? "Sending..." : "Send test"}
      </button>
      {message ? <p className="text-sm text-slate-600 sm:col-span-2">{message}</p> : null}
    </div>
  );
}
