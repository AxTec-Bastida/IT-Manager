"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useCallback, DragEvent, ChangeEvent } from "react";
import { FileKey2, Save, ShieldCheck, Upload, X, CheckCircle2, Info } from "lucide-react";

type ExistingRecord = {
  keyId?: string | null;
  volumeLabel?: string | null;
  protectorId?: string | null;
  source?: string | null;
  notes?: string | null;
} | null;

function parseBitLockerFile(text: string): { recoveryKey?: string; keyId?: string } {
  const result: { recoveryKey?: string; keyId?: string } = {};

  // Match Recovery Key ID: {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}
  const keyIdMatch = text.match(/Recovery Key ID[:\s]*\{?([0-9A-Fa-f\-]{32,36})\}?/i);
  if (keyIdMatch) result.keyId = keyIdMatch[1].toUpperCase();

  // Match Recovery Key: XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX (48 digits, 8 groups)
  const recoveryKeyMatch = text.match(/Recovery Key[:\s\n]*([0-9]{6}(?:-[0-9]{6}){7})/i);
  if (recoveryKeyMatch) result.recoveryKey = recoveryKeyMatch[1];

  return result;
}

export function BitLockerVaultForm({ deviceId, existingRecord }: { deviceId: string; existingRecord: ExistingRecord }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileLoaded, setFileLoaded] = useState<string | null>(null);
  const [parsedKey, setParsedKey] = useState<string>("");
  const [parsedKeyId, setParsedKeyId] = useState<string>(existingRecord?.keyId ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputClass = "min-h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all";
  const labelClass = "block text-sm font-semibold text-slate-700";
  const helpClass = "mt-1 text-xs text-slate-500";

  function processFile(file: File) {
    if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
      setMessage("Please upload a .txt file exported by Windows BitLocker.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseBitLockerFile(text);
      if (!parsed.recoveryKey) {
        setMessage("Could not find a BitLocker recovery key in that file. Make sure it's a BitLocker .txt export.");
        return;
      }
      setFileLoaded(file.name);
      if (parsed.recoveryKey) setParsedKey(parsed.recoveryKey);
      if (parsed.keyId) setParsedKeyId(parsed.keyId);
      setMessage(null);
    };
    reader.readAsText(file);
  }

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  function clearFile() {
    setFileLoaded(null);
    setParsedKey("");
    setParsedKeyId(existingRecord?.keyId ?? "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const payload = {
      recoveryKey: String(formData.get("recoveryKey") || "").trim() || null,
      keyId: String(formData.get("keyId") || "").trim() || null,
      volumeLabel: String(formData.get("volumeLabel") || "").trim() || null,
      protectorId: String(formData.get("protectorId") || "").trim() || null,
      source: String(formData.get("source") || "MANUAL"),
      notes: String(formData.get("notes") || "").trim() || null,
    };
    const response = await fetch(`/api/devices/${deviceId}/bitlocker`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Could not save BitLocker vault record.");
      return;
    }
    router.push(`/devices/${deviceId}/bitlocker?saved=1`);
    router.refresh();
  }

  return (
    <form action={submit} className="space-y-5">

      {/* Error banner */}
      {message ? (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <X size={16} className="mt-0.5 shrink-0 text-rose-500" />
          <p>{message}</p>
        </div>
      ) : null}

      {/* Drag & drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !fileLoaded && fileInputRef.current?.click()}
        className={[
          "relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all",
          dragOver
            ? "border-blue-400 bg-blue-50"
            : fileLoaded
            ? "cursor-default border-emerald-300 bg-emerald-50"
            : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          className="sr-only"
          onChange={handleFileChange}
        />
        {fileLoaded ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <p className="font-semibold text-emerald-800">File loaded successfully</p>
            <p className="text-sm text-emerald-700 font-mono">{fileLoaded}</p>
            <p className="text-xs text-emerald-600">Recovery key and Key ID were extracted automatically.</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              <X size={12} />
              Clear file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200">
              <Upload size={22} className="text-slate-500" />
            </div>
            <p className="font-semibold text-slate-700">Drop your BitLocker .txt file here</p>
            <p className="text-sm text-slate-500">or click to browse</p>
            <p className="mt-1 text-xs text-slate-400">
              Windows saves this file as{" "}
              <span className="font-mono font-medium text-slate-500">BitLocker Recovery Key [ID].txt</span>{" "}
              when you choose &quot;Save to file&quot; during BitLocker setup.
            </p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">or enter manually</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Recovery Key */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-blue-600" />
          <h3 className="font-semibold text-slate-800">Recovery Key</h3>
        </div>

        <div>
          <label className={labelClass} htmlFor="bl-recovery-key">
            Recovery Key <span className="text-rose-500">*</span>
          </label>
          <input
            id="bl-recovery-key"
            className={`${inputClass} font-mono tracking-wide mt-1.5`}
            name="recoveryKey"
            value={parsedKey}
            onChange={(e) => setParsedKey(e.target.value)}
            placeholder="000000-000000-000000-000000-000000-000000-000000-000000"
            autoComplete="off"
            spellCheck={false}
          />
          <p className={helpClass}>
            48-digit recovery key in 8 groups of 6 digits separated by dashes. Leave blank to keep the existing encrypted key when updating other metadata.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="bl-key-id">Key ID</label>
            <input
              id="bl-key-id"
              className={`${inputClass} font-mono mt-1.5`}
              name="keyId"
              value={parsedKeyId}
              onChange={(e) => setParsedKeyId(e.target.value)}
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              autoComplete="off"
            />
            <p className={helpClass}>
              GUID shown on the BitLocker recovery screen. Auto-filled when you upload the .txt file. Used to confirm which key unlocks which drive.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="bl-volume-label">Volume label</label>
            <input
              id="bl-volume-label"
              className={`${inputClass} mt-1.5`}
              name="volumeLabel"
              defaultValue={existingRecord?.volumeLabel ?? "OS"}
              placeholder="OS"
            />
            <p className={helpClass}>
              Drive label (e.g. <span className="font-mono">OS</span>, <span className="font-mono">Data</span>). Use <span className="font-mono">OS</span> for the Windows system drive (C:).
            </p>
          </div>
        </div>
      </div>

      {/* Additional metadata */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileKey2 size={18} className="text-slate-500" />
          <h3 className="font-semibold text-slate-800">Additional Metadata</h3>
          <span className="ml-auto text-xs text-slate-400">Optional</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="bl-protector-id">Protector ID</label>
            <input
              id="bl-protector-id"
              className={`${inputClass} font-mono mt-1.5`}
              name="protectorId"
              defaultValue={existingRecord?.protectorId ?? ""}
              placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
              autoComplete="off"
            />
            <p className={helpClass}>
              Internal TPM protector ID from <span className="font-mono">manage-bde -protectors -get C:</span>. Optional - only fill if your org tracks this for auditing.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="bl-source">Source</label>
            <select id="bl-source" className={`${inputClass} mt-1.5`} name="source" defaultValue={existingRecord?.source ?? "MANUAL"}>
              <option value="MANUAL">Manual entry</option>
              <option value="IMPORT">Bulk import</option>
              <option value="OTHER">Other</option>
            </select>
            <p className={helpClass}>
              How this key was added to the vault. Use <em>Manual entry</em> when saving directly from a .txt file or typing the key.
            </p>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="bl-notes">Notes</label>
          <textarea
            id="bl-notes"
            className={`${inputClass} mt-1.5`}
            name="notes"
            rows={3}
            defaultValue={existingRecord?.notes ?? ""}
            placeholder="e.g. Key exported on 2024-01-15 after re-encryption, stored on IT USB vault"
          />
          <p className={helpClass}>
            Internal notes about this key - when it was generated, re-encrypted, or any special circumstances.
          </p>
        </div>
      </div>

      {/* Info callout */}
      <div className="flex gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
        <Info size={14} className="mt-0.5 shrink-0 text-blue-500" />
        <p>
          The recovery key value is <strong>AES-encrypted before storage</strong> and is never displayed in plaintext by default. Only authorized vault administrators can reveal it.
        </p>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          disabled={saving}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save BitLocker record"}
        </button>
        {fileLoaded && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <CheckCircle2 size={14} />
            Key auto-filled from file
          </span>
        )}
      </div>
    </form>
  );
}
