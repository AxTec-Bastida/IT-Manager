"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";

type PreviewRow = { row: number; ok: boolean; errors: string[]; data: Record<string, unknown> };

export function ImportExportPanel() {
  const [type, setType] = useState("devices");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function previewImport(commit = false) {
    setMessage(null);
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, csv, commit }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Import failed.");
      if (Array.isArray(data.details)) setPreview(data.details);
      return;
    }
    if (commit) {
      setMessage(`Imported ${data.imported} ${type}.`);
      setPreview([]);
      setCsv("");
    } else {
      setPreview(data.preview ?? []);
      setMessage(`${data.validCount} valid row(s), ${data.errorCount} row(s) with errors.`);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">Import/export CSV</h2>
          <p className="mt-1 text-sm text-slate-600">Preview CSV rows before saving, with IP validation and duplicate checks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["devices", "ranges", "conflicts", "scan-results", "stock-items", "stock-movements", "maintenance-records", "facturas"].map((exportType) => (
            <a key={exportType} href={`/api/export/${exportType}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <Download size={16} />
              {exportType}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <select value={type} onChange={(event) => setType(event.target.value)} className="min-h-12 max-w-xs rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
          <option value="devices">Devices</option>
          <option value="ranges">Ranges</option>
          <option value="stock-items">Stock Items</option>
        </select>
        <textarea
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          rows={7}
          className="w-full rounded-md border border-slate-300 p-3 font-mono text-base sm:text-sm"
          placeholder={
            type === "devices"
              ? "name,category,ipAddress,macAddress,vlan,status\nPACK-ZT410-03,THERMAL_PRINTER,192.168.163.22,00:11:22:33:44:22,163,ACTIVE"
              : type === "stock-items"
                ? "name,sku,category,itemType,quantityOnHand,minimumQuantity,vendorName,storageLocation\nZebra ZT411 Printhead,PRT-ZT411-PH,PRINTER_PART,SPARE_PART,2,1,Zebra,IT cage shelf B2"
                : "name,category,vlan,startIp,endIp,location\nReturns Printers,THERMAL_PRINTER,163,192.168.163.90,192.168.163.110,Returns"
          }
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => previewImport(false)} className="inline-flex min-h-12 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <Upload size={16} />
            Preview import
          </button>
          <button type="button" onClick={() => previewImport(true)} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Save valid CSV
          </button>
        </div>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
        {preview.length ? (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((row) => (
                  <tr key={row.row}>
                    <td className="px-3 py-2">{row.row}</td>
                    <td className="px-3 py-2">{row.ok && row.errors.length === 0 ? "Ready" : "Needs fix"}</td>
                    <td className="px-3 py-2 text-rose-700">{row.errors.join(" ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
