"use client";

import { useState } from "react";
import type { IpRange } from "@prisma/client";
import { Radar } from "lucide-react";

type ScanState = {
  results?: Array<{ ipAddress: string; reachable: boolean; macAddress?: string | null; hostname?: string | null; note?: string | null }>;
  findings?: Array<{ ipAddress: string; severity: string; message: string }>;
  error?: string;
};

export function ScannerPanel({ ranges, defaults }: { ranges: IpRange[]; defaults: { maxScanSize: number; pingTimeoutMs: number } }) {
  const [state, setState] = useState<ScanState>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setState({});
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch("/api/scanner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setState({ error: data.error || "Scan failed." });
      return;
    }
    setState({ results: data.results, findings: data.findings });
  }

  const inputClass = "w-full min-h-12 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:text-sm";

  return (
    <div className="space-y-5">
      <form action={onSubmit} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-4">
        <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
          Scan saved range
          <select className={inputClass} name="rangeId">
            <option value="">Use manual start/end IP</option>
            {ranges.map((range) => (
              <option key={range.id} value={range.id}>
                {range.name} ({range.startIp} - {range.endIp})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Start IP
          <input className={inputClass} name="startIp" placeholder="192.168.163.20" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          End IP
          <input className={inputClass} name="endIp" placeholder="192.168.163.40" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Timeout ms
          <input className={inputClass} name="timeoutMs" type="number" defaultValue={defaults.pingTimeoutMs} />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Max scan size
          <input className={inputClass} name="maxScanSize" type="number" defaultValue={defaults.maxScanSize} />
        </label>
        <div className="flex items-end lg:col-span-2">
          <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto sm:text-sm" disabled={loading}>
            <Radar size={16} />
            {loading ? "Scanning..." : "Start server-side scan"}
          </button>
        </div>
      </form>

      {state.error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{state.error}</div> : null}
      {state.findings?.length ? (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-950">Scan findings</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {state.findings.map((finding) => (
              <div key={`${finding.ipAddress}-${finding.message}`} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-mono text-sm text-slate-950">{finding.ipAddress}</span>
                <span className="text-sm text-slate-600">{finding.message}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {state.results?.length ? (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Reachable</th>
                <th className="px-4 py-3">MAC</th>
                <th className="px-4 py-3">Hostname</th>
                <th className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.results.map((result) => (
                <tr key={result.ipAddress}>
                  <td className="px-4 py-3 font-mono">{result.ipAddress}</td>
                  <td className="px-4 py-3">{result.reachable ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{result.macAddress || "-"}</td>
                  <td className="px-4 py-3">{result.hostname || "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{result.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="divide-y divide-slate-100 md:hidden">
            {state.results.map((result) => (
              <div key={result.ipAddress} className="p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-mono font-semibold">{result.ipAddress}</span>
                  <span>{result.reachable ? "Reachable" : "No reply"}</span>
                </div>
                <p className="mt-1 text-slate-500">{result.macAddress || result.hostname || result.note || "No extra details"}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
