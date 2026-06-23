"use client";

import { useEffect, useRef, useState } from "react";
import { Laptop, Search, User, Users } from "lucide-react";
import { categoryLabels, statusLabels, statusTone } from "@/lib/constants";

export type ScanSuggestionEmployee = {
  kind: "employee";
  id: string;
  fullName: string;
  employeeId?: string | null;
  department?: string | null;
  stockIssues?: unknown[];
  assetLoans?: unknown[];
};

export type ScanSuggestionTemp = {
  kind: "temporary";
  id: string;
  tempId: string;
  name: string;
  department?: string | null;
  area?: string | null;
  needsReview?: boolean;
  stockIssues?: unknown[];
  assetLoans?: unknown[];
};

export type ScanSuggestionDevice = {
  kind: "device";
  id: string;
  name: string;
  assetTag?: string | null;
  serialNumber?: string | null;
  model?: string | null;
  category: string;
  status: string;
  condition: string;
  assignedTo?: string | null;
  employee?: { fullName: string } | null;
};

export type ScanSuggestion = ScanSuggestionEmployee | ScanSuggestionTemp | ScanSuggestionDevice;

type Props = {
  /** What entity types to include in suggestions */
  show?: ("employees" | "temporaryBorrowers" | "devices" | "stockItems")[];
  /** Limits per group */
  maxPerGroup?: number;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  onSelect: (suggestion: ScanSuggestion) => void;
  /** Optional: called when user presses Enter without selecting a dropdown item */
  onSubmit?: (value: string) => void;
};

export function ScanAutocomplete({
  show = ["employees", "temporaryBorrowers", "devices"],
  maxPerGroup = 5,
  placeholder = "Search or scan...",
  className = "",
  inputClassName = "",
  autoFocus = false,
  onSelect,
  onSubmit,
}: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ScanSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/scan-lookup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value: q }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const results: ScanSuggestion[] = [
          ...(show.includes("employees") ? (data.employees ?? []).slice(0, maxPerGroup).map((e: ScanSuggestionEmployee) => ({ ...e, kind: "employee" as const })) : []),
          ...(show.includes("temporaryBorrowers") ? (data.temporaryBorrowers ?? []).slice(0, maxPerGroup).map((t: ScanSuggestionTemp) => ({ ...t, kind: "temporary" as const })) : []),
          ...(show.includes("devices") ? (data.devices ?? []).slice(0, maxPerGroup).map((d: ScanSuggestionDevice) => ({ ...d, kind: "device" as const })) : []),
        ];
        setSuggestions(results);
        setActiveIndex(-1);
        setOpen(results.length > 0);
      } catch {
        // silently ignore typeahead network errors
      }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, show, maxPerGroup]);

  function close() {
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  }

  function pick(s: ScanSuggestion) {
    close();
    setQuery("");
    onSelect(s);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "Enter" && onSubmit) {
        e.preventDefault();
        onSubmit(query);
        setQuery("");
        close();
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) { pick(suggestions[activeIndex]); }
      else if (onSubmit) { onSubmit(query); setQuery(""); close(); }
    }
    else if (e.key === "Escape") { close(); inputRef.current?.blur(); }
  }

  const employees = suggestions.filter((s): s is ScanSuggestionEmployee => s.kind === "employee");
  const temps = suggestions.filter((s): s is ScanSuggestionTemp => s.kind === "temporary");
  const devices = suggestions.filter((s): s is ScanSuggestionDevice => s.kind === "device");

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          const nextValue = e.target.value;
          setQuery(nextValue);
          if (nextValue.trim().length < 2) {
            setSuggestions([]);
            setOpen(false);
          }
        }}
        onFocus={() => { if (suggestions.length) setOpen(true); }}
        onBlur={(e) => { if (!listRef.current?.contains(e.relatedTarget as Node)) close(); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        className={`w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${inputClassName}`}
      />

      {open && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
        >
          {/* Employees */}
          {employees.length > 0 && (
            <section>
              <header className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                <User size={11} className="text-slate-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Employees</span>
              </header>
              {employees.map((s) => {
                const idx = suggestions.indexOf(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    tabIndex={0}
                    onMouseDown={() => pick(s)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-blue-50 ${idx === activeIndex ? "bg-blue-50" : ""}`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                      <User size={13} className="text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{s.fullName}</p>
                      <p className="truncate text-xs text-slate-500">{[s.employeeId, s.department].filter(Boolean).join(" / ") || "Employee"}</p>
                    </div>
                    {(s.assetLoans as unknown[])?.length ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        {(s.assetLoans as unknown[]).length} loans
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </section>
          )}

          {/* Temp Borrowers */}
          {temps.length > 0 && (
            <section>
              <header className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                <Users size={11} className="text-slate-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Temp Borrowers</span>
              </header>
              {temps.map((s) => {
                const idx = suggestions.indexOf(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    tabIndex={0}
                    onMouseDown={() => pick(s)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-blue-50 ${idx === activeIndex ? "bg-blue-50" : ""}`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100">
                      <Users size={13} className="text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
                      <p className="truncate text-xs text-slate-500">{[s.tempId, s.department || s.area].filter(Boolean).join(" / ")}</p>
                    </div>
                    {s.needsReview && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">Incomplete</span>
                    )}
                  </button>
                );
              })}
            </section>
          )}

          {/* Devices */}
          {devices.length > 0 && (
            <section>
              <header className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                <Laptop size={11} className="text-slate-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assets</span>
              </header>
              {devices.map((s) => {
                const idx = suggestions.indexOf(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    tabIndex={0}
                    onMouseDown={() => pick(s)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-blue-50 ${idx === activeIndex ? "bg-blue-50" : ""}`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                      <Laptop size={13} className="text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {[s.assetTag, s.model, categoryLabels[s.category as keyof typeof categoryLabels] ?? s.category].filter(Boolean).join(" / ")}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${statusTone[s.status as keyof typeof statusTone] ?? "bg-slate-100 text-slate-700"}`}>
                      {statusLabels[s.status as keyof typeof statusLabels] ?? s.status}
                    </span>
                  </button>
                );
              })}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
