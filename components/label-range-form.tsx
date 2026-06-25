"use client";

import { useState } from "react";

export function RangeForm({ initialValues }: { initialValues: { prefix?: string; start?: string; end?: string; padding?: string } }) {
  const [prefix, setPrefix] = useState(initialValues.prefix ?? "J");
  const [start, setStart] = useState(Number(initialValues.start ?? "1"));
  const [end, setEnd] = useState(Number(initialValues.end ?? "10"));
  const [padding, setPadding] = useState(Number(initialValues.padding ?? "2"));

  const count = end >= start ? (end - start + 1) : 0;

  const getLabel = (num: number) => {
    return `${prefix}${String(num).padStart(padding, "0")}`;
  };

  const previewText = () => {
    if (count <= 0) return "Invalid range (Start must be <= End)";
    if (count <= 5) {
      return Array.from({ length: count }, (_, i) => getLabel(start + i)).join(", ");
    }
    const first3 = Array.from({ length: 3 }, (_, i) => getLabel(start + i)).join(", ");
    const last1 = getLabel(end);
    return `${first3} ... ${last1}`;
  };

  return (
    <form className="space-y-4">
      <input type="hidden" name="mode" value="range" />
      <div className="grid gap-3 md:grid-cols-5">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Prefix
          <input name="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Start
          <input name="start" type="number" value={start} onChange={(e) => setStart(parseInt(e.target.value, 10) || 0)} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          End
          <input name="end" type="number" value={end} onChange={(e) => setEnd(parseInt(e.target.value, 10) || 0)} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Padding
          <input name="padding" type="number" min="0" max="12" value={padding} onChange={(e) => setPadding(parseInt(e.target.value, 10) || 0)} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        </label>
        <button type="submit" className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white md:mt-6">Preview range</button>
      </div>
      <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600 flex justify-between items-center border border-slate-200">
        <span><strong>Preview:</strong> {previewText()}</span>
        <span><strong>Total Count:</strong> {count} label{count !== 1 ? "s" : ""}</span>
      </div>
    </form>
  );
}

export function BatchForm({ initialValues }: { initialValues: { visibleTemplate?: string; encodedTemplate?: string; start?: string; end?: string; padding?: string } }) {
  const [visibleTemplate, setVisibleTemplate] = useState(initialValues.visibleTemplate ?? "K{num}");
  const [encodedTemplate, setEncodedTemplate] = useState(initialValues.encodedTemplate ?? initialValues.visibleTemplate ?? "K{num}");
  const [start, setStart] = useState(Number(initialValues.start ?? "1"));
  const [end, setEnd] = useState(Number(initialValues.end ?? "24"));
  const [padding, setPadding] = useState(Number(initialValues.padding ?? "2"));

  const count = end >= start ? (end - start + 1) : 0;

  const getLabel = (num: number, temp: string) => {
    const numberStr = String(num).padStart(padding, "0");
    return temp.replaceAll("{num}", numberStr);
  };

  const previewText = () => {
    if (count <= 0) return "Invalid range (Start must be <= End)";
    const getPair = (n: number) => {
      const vis = getLabel(n, visibleTemplate);
      const enc = getLabel(n, encodedTemplate);
      return vis === enc ? vis : `${vis} (${enc})`;
    };
    if (count <= 3) {
      return Array.from({ length: count }, (_, i) => getPair(start + i)).join(", ");
    }
    const first2 = Array.from({ length: 2 }, (_, i) => getPair(start + i)).join(", ");
    const last1 = getPair(end);
    return `${first2} ... ${last1}`;
  };

  return (
    <form className="space-y-3">
      <input type="hidden" name="mode" value="batch" />
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-950">Batch sheet mode</p>
        <p className="mt-1">Use <span className="font-mono">{"{num}"}</span> where the padded number belongs. Visible text is printed; encoded value is what the scanner reads.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Visible text pattern
          <input name="visibleTemplate" value={visibleTemplate} onChange={(e) => setVisibleTemplate(e.target.value)} placeholder="K{num}" className="min-h-12 rounded-md border border-slate-300 px-3 font-mono text-base sm:text-sm" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Encoded scan pattern
          <input name="encodedTemplate" value={encodedTemplate} onChange={(e) => setEncodedTemplate(e.target.value)} placeholder="Zebra-K{num}" className="min-h-12 rounded-md border border-slate-300 px-3 font-mono text-base sm:text-sm" />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Start
          <input name="start" type="number" value={start} onChange={(e) => setStart(parseInt(e.target.value, 10) || 0)} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          End
          <input name="end" type="number" value={end} onChange={(e) => setEnd(parseInt(e.target.value, 10) || 0)} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Padding
          <input name="padding" type="number" min="0" max="12" value={padding} onChange={(e) => setPadding(parseInt(e.target.value, 10) || 0)} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        </label>
        <button type="submit" className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white md:mt-6">Preview batch sheet</button>
      </div>
      <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600 flex justify-between items-center border border-slate-200">
        <span><strong>Preview (Visible & Encoded):</strong> {previewText()}</span>
        <span><strong>Total Count:</strong> {count} label{count !== 1 ? "s" : ""}</span>
      </div>
    </form>
  );
}
