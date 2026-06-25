import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPageRole } from "@/lib/page-permissions";
import { Wrench, ArrowRight, HelpCircle, Info, Settings } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminStockMaintenanceDefaultsPage() {
  if (!(await hasPageRole("ADMIN"))) {
    return <ForbiddenPanel message="Stock & maintenance defaults settings are admin-only." />;
  }

  // Sample static interval options for the documentation
  const intervalUnits = [
    { unit: "Days", example: "30 days (Default for Thermal printhead cleaning)" },
    { unit: "Weeks", example: "2 weeks (Ops scanner audit checks)" },
    { unit: "Months", example: "6 months (Scale weight calibrations)" },
    { unit: "Years", example: "1 year (Electrical safety & compliance audits)" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Stock & Maintenance Defaults"
        description="Configure low-stock alert thresholds, printer consumables, and schedule profiles."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Side: System settings doc and links */}
        <div className="md:col-span-2 space-y-6">
          {/* Active rules */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
              <Settings size={18} className="text-slate-500" />
              Active Stockroom Rules
            </h2>
            <p className="text-sm text-slate-600">
              Settings governing low-stock automated alerts and consumable replenishment.
            </p>

            <div className="divide-y divide-slate-100">
              <div className="py-3 flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Default Low-Stock Threshold</span>
                <span className="font-semibold text-slate-950">2 items (Global)</span>
              </div>
              <div className="py-3 flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Printer Cleaning Frequency</span>
                <span className="font-semibold text-slate-950">Every 30 days of active use</span>
              </div>
              <div className="py-3 flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Required Task Category for Repaired Assets</span>
                <span className="font-semibold text-slate-950">"Maintenance"</span>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 flex items-center justify-between">
              <div className="text-xs text-slate-500 leading-normal">
                <p className="font-bold text-slate-700">Controlled Lists Foundation</p>
                <p className="mt-0.5">Edit active categories, consumables, and profiles directly in Master Data.</p>
              </div>
              <Link
                href="/admin/master-data"
                className="inline-flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Go to Master Data
                <ArrowRight size={13} />
              </Link>
            </div>
          </section>

          {/* Maintenance intervals doc */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
              <Wrench size={18} className="text-slate-500" />
              Maintenance Schedule Intervals
            </h2>
            <p className="text-sm text-slate-600">
              Scheduled tasks support clean recurrences based on the following standard time units:
            </p>

            <div className="overflow-hidden rounded-lg border border-slate-200 text-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 font-semibold text-slate-900">
                  <tr>
                    <th className="px-4 py-2 text-left">Interval Unit</th>
                    <th className="px-4 py-2 text-left">Typical Application Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-800">
                  {intervalUnits.map((u) => (
                    <tr key={u.unit}>
                      <td className="px-4 py-2.5 font-bold text-slate-900">{u.unit}</td>
                      <td className="px-4 py-2.5 text-slate-500 font-normal">{u.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-950 flex gap-2">
              <Info size={16} className="text-blue-700 shrink-0 mt-0.5" />
              <p>
                <strong>Phase 90F Notice:</strong> Active code logic running scheduled jobs and emailing technician alerts on recurring intervals is currently locked. These configurations will become fully active in the upcoming maintenance workflow phase.
              </p>
            </div>
          </section>
        </div>

        {/* Right Side: Read-only forms */}
        <div className="md:col-span-1 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 opacity-75">
            <h2 className="text-base font-bold text-slate-950">Interval Thresholds</h2>
            <div className="space-y-4 pt-2 pointer-events-none text-xs">
              <label className="block font-semibold text-slate-700 space-y-1">
                <span>Default Alert Level</span>
                <select className="w-full min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500">
                  <option>Warning (Orange flag)</option>
                  <option>Critical (Red block)</option>
                </select>
              </label>

              <label className="block font-semibold text-slate-700 space-y-1">
                <span>Preventative Threshold</span>
                <input
                  type="number"
                  defaultValue={14}
                  className="w-full min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500"
                />
                <span className="text-[10px] text-slate-400 font-normal">Days notice before next due check</span>
              </label>

              <label className="block font-semibold text-slate-700 space-y-1">
                <span>Enable Consumable Tracking</span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="checkbox" defaultChecked disabled className="size-4 rounded text-slate-300" />
                  <span className="text-slate-500">Toner & Label roll levels</span>
                </div>
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
