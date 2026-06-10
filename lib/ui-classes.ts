export function chipButtonClass(selected: boolean, disabled = false) {
  const base = "inline-flex min-h-12 items-center justify-center rounded-md border px-3 text-sm font-semibold transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950";
  if (disabled) return `${base} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400`;
  if (selected) return `${base} border-slate-950 bg-slate-950 text-white shadow-sm`;
  return `${base} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`;
}
