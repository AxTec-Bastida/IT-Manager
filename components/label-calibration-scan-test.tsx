"use client";

import { useMemo, useState } from "react";
import { compareCalibrationScan } from "@/lib/label-calibration";

type Props = {
  expectedValues: string[];
};

export function LabelCalibrationScanTest({ expectedValues }: Props) {
  const [value, setValue] = useState("");
  const result = useMemo(() => compareCalibrationScan(value, expectedValues), [value, expectedValues]);
  const resultClass =
    result.status === "match"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : result.status === "unexpected"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Manual scan test</h2>
      <p className="mt-1 text-sm text-slate-500">Scan one printed test label into this box. This checks the scanner output only; it does not query inventory or create aliases.</p>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Scan test label here
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-14 rounded-md border border-slate-300 px-3 font-mono text-base"
            placeholder="Example: Zebra-J192"
            autoComplete="off"
          />
        </label>
        <div className={`rounded-md border p-3 text-sm font-semibold ${resultClass}`}>{result.message}</div>
        <div className="grid gap-2 sm:flex">
          <button type="button" onClick={() => navigator.clipboard?.writeText(value)} disabled={!value} className="min-h-12 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">
            Copy result
          </button>
          <button type="button" onClick={() => setValue("")} className="min-h-12 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
