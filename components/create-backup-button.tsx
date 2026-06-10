"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatabaseBackup } from "lucide-react";

export function CreateBackupButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createBackup() {
    setRunning(true);
    setMessage(null);
    const response = await fetch("/api/backups", { method: "POST" });
    const data = await response.json();
    setRunning(false);
    if (response.ok) {
      setMessage(`Backup created: ${data.manifest.backupPath}`);
      router.refresh();
    } else {
      setMessage(data.error || "Backup failed.");
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={createBackup}
        disabled={running}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        <DatabaseBackup size={16} />
        {running ? "Creating..." : "Create backup"}
      </button>
      {message ? <p className="max-w-sm break-words text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}
