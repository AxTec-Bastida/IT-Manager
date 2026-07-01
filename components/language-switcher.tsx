"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { clsx } from "clsx";
import { localeLabels, locales, type Locale } from "@/lib/i18n";

export function LanguageSwitcher({ locale, label, compact = false }: { locale: Locale; label: string; compact?: boolean }) {
  const [saving, setSaving] = useState(false);

  async function updateLocale(nextLocale: Locale) {
    if (nextLocale === locale || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/language", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      if (!response.ok) throw new Error("Could not update language.");
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={clsx("rounded-lg border", compact ? "border-slate-200 bg-slate-50 p-2" : "border-slate-800 bg-slate-950/40 p-3")}>
      <div className={clsx("mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide", compact ? "text-slate-500" : "text-slate-400")}>
        <Languages size={14} />
        {label}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {locales.map((option) => (
          <button
            key={option}
            type="button"
            disabled={saving}
            onClick={() => updateLocale(option)}
            className={clsx(
              "min-h-10 rounded-md px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:opacity-60",
              option === locale
                ? compact
                  ? "bg-slate-950 text-white"
                  : "bg-white text-slate-950"
                : compact
                  ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  : "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            {localeLabels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
