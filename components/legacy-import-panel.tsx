"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Badge } from "@/components/badge";

type LegacySheetSummary = {
  sheetName: string;
  kind: string;
  defaultSelected: boolean;
  ignoredByDefault: boolean;
  rowCount: number;
  headerRow: number | null;
  columns: string[];
  warnings: string[];
};

type LegacyPreviewRow = {
  id: string;
  sheetName: string;
  rowNumber: number;
  target: string;
  action: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
  duplicate?: { type: string; label: string; warningOnly?: boolean };
  data: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

type LegacyPreview = {
  fileName: string;
  sheets: LegacySheetSummary[];
  rows: LegacyPreviewRow[];
  summary: {
    sheetsDetected: number;
    sheetsSelected: number;
    rowsDetected: number;
    rowsToCreate: number;
    rowsToUpdate: number;
    rowsSkipped: number;
    validRows: number;
    errorRows: number;
    warningRows: number;
    duplicateRows: number;
    redactedNotes: number;
    skippedCommentLikeStockRows?: number;
  };
  imported?: number;
  updated?: number;
  importRunId?: string;
};

export function LegacyImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [preview, setPreview] = useState<LegacyPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);

  const visibleRows = useMemo(() => preview?.rows.slice(0, 80) ?? [], [preview]);

  async function submit(commit = false) {
    if (!file) {
      setMessage("Choose the legacy .xlsx workbook first.");
      return;
    }
    setLoading(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("commit", String(commit));
    formData.set("backupConfirmed", String(backupConfirmed));
    if (selectedSheets.length) formData.set("selectedSheets", JSON.stringify(selectedSheets));

    const response = await fetch("/api/import/legacy-sheet", { method: "POST", body: formData });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Legacy import failed.");
      return;
    }
    setPreview(data);
    if (!selectedSheets.length && Array.isArray(data.sheets)) {
      setSelectedSheets(data.sheets.filter((sheet: LegacySheetSummary) => sheet.defaultSelected).map((sheet: LegacySheetSummary) => sheet.sheetName));
    }
    setMessage(commit ? `Import complete: ${data.imported ?? 0} created, ${data.updated ?? 0} updated.` : "Preview ready. No records were saved.");
  }

  function toggleSheet(sheetName: string) {
    setSelectedSheets((current) => current.includes(sheetName) ? current.filter((name) => name !== sheetName) : [...current, sheetName]);
  }

  function downloadReport(kind: "error" | "warning" | "duplicate") {
    if (!preview) return;
    const reportRows = preview.rows.filter((row) => {
      if (kind === "error") return row.errors.length > 0;
      if (kind === "warning") return row.warnings.length > 0;
      return hasDuplicateSignal(row);
    });
    const rows = [["Sheet", "Row", "Target", "Action", "Type", "Message", "Suggested Fix", "Raw Row", "Name/Tag"]];
    for (const row of reportRows) {
      const messages = kind === "error" ? row.errors : kind === "warning" ? row.warnings : duplicateMessages(row);
      rows.push([
        row.sheetName,
        String(row.rowNumber),
        row.target,
        row.action,
        kind.toUpperCase(),
        messages.join(" | "),
        suggestedFix(row, messages),
        safeRawJson(row),
        String(row.data.name ?? row.data.assetTag ?? row.data.facturaNumber ?? ""),
      ]);
    }
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `legacy-import-${kind}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Upload legacy workbook</h2>
            <p className="mt-1 text-sm text-slate-600">Preview first. Uploading does not save inventory records.</p>
          </div>
          <FileSpreadsheet className="hidden text-slate-400 sm:block" size={28} />
        </div>
        <label className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:bg-slate-100">
          <Upload className="text-slate-500" size={24} />
          <span className="mt-2 text-sm font-semibold text-slate-950">{file ? file.name : "Choose Inventario Tech 2.0 .xlsx"}</span>
          <span className="mt-1 text-xs text-slate-500">The workbook is parsed server-side and left unchanged.</span>
          <input type="file" accept=".xlsx" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex gap-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>Before final import, back up <code>prisma/dev.db</code>, <code>uploads/assets</code>, and <code>uploads/facturas</code>.</p>
          </div>
          <label className="mt-3 flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={backupConfirmed} onChange={(event) => setBackupConfirmed(event.target.checked)} className="size-4" />
            Backup completed and I am ready for final import
          </label>
        </div>
        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          <button type="button" disabled={loading} onClick={() => submit(false)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">
            Preview / dry run
          </button>
          <button type="button" disabled={loading || !backupConfirmed} onClick={() => submit(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
            Import valid rows only
          </button>
          {preview ? (
            <>
              <button type="button" onClick={() => downloadReport("error")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Download size={16} />
                Error CSV
              </button>
              <button type="button" onClick={() => downloadReport("warning")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Download size={16} />
                Warning CSV
              </button>
              <button type="button" onClick={() => downloadReport("duplicate")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Download size={16} />
                Duplicate CSV
              </button>
            </>
          ) : null}
        </div>
        {message ? <p className="mt-3 text-sm font-medium text-slate-700">{message}</p> : null}
      </section>

      {preview ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9">
              {[
                ["Sheets", preview.summary.sheetsDetected],
                ["Selected", preview.summary.sheetsSelected],
                ["Rows", preview.summary.rowsDetected],
                ["Create", preview.summary.rowsToCreate],
                ["Update", preview.summary.rowsToUpdate],
                ["Skipped", preview.summary.rowsSkipped],
                ["Errors", preview.summary.errorRows],
                ["Redacted", preview.summary.redactedNotes],
                ["Comment rows", preview.summary.skippedCommentLikeStockRows ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-950">Detected sheets</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {preview.sheets.map((sheet) => (
                <label key={sheet.sheetName} className="flex min-h-16 gap-3 rounded-md border border-slate-200 p-3">
                  <input type="checkbox" checked={selectedSheets.includes(sheet.sheetName)} onChange={() => toggleSheet(sheet.sheetName)} className="mt-1 size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-950">{sheet.sheetName}</span>
                      <Badge className={sheet.defaultSelected ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}>{sheet.kind}</Badge>
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">{sheet.rowCount} rows, {sheet.columns.length || "no"} detected columns</span>
                    {sheet.warnings.length ? <span className="mt-1 block text-xs text-amber-700">{sheet.warnings.join(" ")}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-950">Validation preview</h2>
              <p className="text-xs text-slate-500">Showing first {visibleRows.length} rows</p>
            </div>
            <div className="mt-3 grid gap-3 lg:hidden">
              {visibleRows.map((row) => <PreviewCard key={row.id} row={row} />)}
            </div>
            <div className="mt-3 hidden overflow-x-auto rounded-md border border-slate-200 lg:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Sheet</th>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Errors / warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 font-medium">{row.sheetName}</td>
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.target}</td>
                      <td className="px-3 py-2">{row.action}</td>
                      <td className="px-3 py-2">
                        <span className="text-rose-700">{row.errors.join(" ")}</span>
                        <span className="text-amber-700">{row.warnings.join(" ")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function hasDuplicateSignal(row: LegacyPreviewRow) {
  return Boolean(row.duplicate) || row.warnings.some((warning) => warning.toLowerCase().includes("duplicate"));
}

function duplicateMessages(row: LegacyPreviewRow) {
  const messages = row.warnings.filter((warning) => warning.toLowerCase().includes("duplicate"));
  if (row.duplicate) messages.unshift(`${row.duplicate.type}: ${row.duplicate.label}`);
  return messages;
}

function suggestedFix(row: LegacyPreviewRow, messages: string[]) {
  const text = messages.join(" ").toLowerCase();
  if (text.includes("asset tag") || text.includes("serial")) return "Add an asset tag or serial number, or confirm this row is a helper/side-table row.";
  if (text.includes("stock row needs")) return "Add an item name, brand/model, or ID, or leave the row unselected if it is a helper table.";
  if (text.includes("quantity")) return "Check the quantity cell and use a whole number if this should import as stock.";
  if (text.includes("invalid ip")) return "Correct the IPv4 value or leave it blank for assets that do not need network tracking.";
  if (text.includes("credential")) return "Keep the redacted note and move credentials to the approved password manager or SOP.";
  if (row.duplicate || text.includes("duplicate")) return "Review the existing matching record before importing as an update.";
  return "Review the source row and confirm the preview before final import.";
}

function safeRawJson(row: LegacyPreviewRow) {
  const raw = JSON.stringify(row.raw ?? row.data ?? {});
  if (row.warnings.some((warning) => warning.toLowerCase().includes("credential redacted"))) {
    return "[raw hidden because credential-like text was redacted]";
  }
  return redactCredentialText(raw);
}

function redactCredentialText(value: string) {
  const withUserRedacted = /(password|pass|pwd|token|api\s*key)\s*[:=]/i.test(value)
    ? value.replace(/(user|usuario|username|login)\\?":\s*\\?"?[^,;}"]+/gi, "$1\":\"[REDACTED]")
    : value;
  return withUserRedacted.replace(/(password|pass|pwd|token|api\s*key)(\\?":|\\?=)\s*\\?"?[^,;}"]+/gi, "$1$2\"[REDACTED]");
}

function PreviewCard({ row }: { row: LegacyPreviewRow }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{row.sheetName} row {row.rowNumber}</p>
          <p className="text-sm text-slate-500">{row.target} / {row.action}</p>
        </div>
        <Badge className={row.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-800 ring-rose-200"}>{row.ok ? "Valid" : "Error"}</Badge>
      </div>
      {row.errors.length ? <p className="mt-3 text-sm text-rose-700">{row.errors.join(" ")}</p> : null}
      {row.warnings.length ? <p className="mt-3 text-sm text-amber-700">{row.warnings.join(" ")}</p> : null}
    </article>
  );
}
