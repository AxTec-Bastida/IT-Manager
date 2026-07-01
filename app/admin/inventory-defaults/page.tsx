import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPageRole } from "@/lib/page-permissions";
import { Sliders, CheckCircle, Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminInventoryDefaultsPage() {
  if (!(await hasPageRole("ADMIN"))) {
    return <ForbiddenPanel message="Inventory defaults settings are admin-only." />;
  }

  // Active default constants mapped inside the system intake workflows
  const defaultPrefixes = [
    { category: "LAPTOP", prefix: "GHT-LP", description: "Laptops issued to staff or contractors" },
    { category: "SLED", prefix: "GHT-SLD", description: "Scanning sleds used in Ops" },
    { category: "IPOD", prefix: "GHT-IPO", description: "iPod devices used with sleds" },
    { category: "IPHONE", prefix: "GHT-IPH", description: "iPhone devices used with sleds" },
    { category: "IPAD", prefix: "GHT-IPA", description: "iPad devices and tablets" },
    { category: "PHONE", prefix: "GHT-PH", description: "Generic phones when not iPhone-specific" },
    { category: "THERMAL_PRINTER", prefix: "GHT-PR", description: "Zebra label and thermal printers" },
    { category: "OTHER", prefix: "GHT-OT", description: "Other general equipment" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Inventory Defaults"
        description="Configure default prefixes, statuses, and workflow requirements for equipment intake."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Side: Real system defaults */}
        <div className="md:col-span-2 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-600" />
              Active System Intake Defaults
            </h2>
            <p className="text-sm text-slate-600">
              The following default values are automatically suggested to IT technicians during new asset intake to speed up processing and prevent data drift.
            </p>

            <div className="divide-y divide-slate-100 mt-2">
              <div className="py-3 flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Default New Asset Status</span>
                <span className="font-semibold text-slate-950">READY (Stockroom)</span>
              </div>
              <div className="py-3 flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Default New Asset Condition</span>
                <span className="font-semibold text-slate-950">EXCELLENT (New)</span>
              </div>
              <div className="py-3 flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Laptop Charger Default</span>
                <span className="font-semibold text-slate-950">&quot;Has Charger&quot; checked by default</span>
              </div>
              <div className="py-3 flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Photo Intake Requirement</span>
                <span className="font-semibold text-slate-950">Required for Laptop/Sled/iPod/iPhone/iPad, optional others</span>
              </div>
            </div>
          </section>

          {/* Tag Prefixes */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-950">Official Asset Tag Prefixes</h2>
            <p className="text-sm text-slate-600">
              Standard prefixes pre-filled on barcode/QR code generation and label printing based on category.
            </p>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-900">Category</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-900">Asset Tag Prefix</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-900">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-800">
                  {defaultPrefixes.map((p) => (
                    <tr key={p.category}>
                      <td className="px-4 py-3">{p.category}</td>
                      <td className="px-4 py-3 font-mono text-slate-900">{p.prefix}</td>
                      <td className="px-4 py-3 text-slate-500 font-normal">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Side: Read-only placeholder UI for future settings */}
        <div className="md:col-span-1 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 opacity-75">
            <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
              <Sliders size={18} className="text-slate-500" />
              Dynamic Rules Config
            </h2>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-950 flex gap-2">
              <Info size={16} className="text-blue-700 shrink-0" />
              <p>Dynamic configuration of intake parameters is read-only. Custom overrides are scheduled for Phase 90C.</p>
            </div>

            <div className="space-y-4 pt-2 pointer-events-none">
              <label className="block text-xs font-semibold text-slate-700 space-y-1">
                <span>Default Intake Location</span>
                <select className="w-full min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500">
                  <option>Receiving Area (Default)</option>
                  <option>IT Cage</option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-700 space-y-1">
                <span>Auto-Generate Asset Tags</span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="checkbox" defaultChecked disabled className="size-4 rounded text-slate-300" />
                  <span className="text-slate-500">Enabled on technician forms</span>
                </div>
              </label>

              <label className="block text-xs font-semibold text-slate-700 space-y-1">
                <span>Photo Compliance Policy</span>
                <select className="w-full min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500">
                  <option>Strict (Block saving without upload)</option>
                  <option>Warn (Flag in Data Quality)</option>
                </select>
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
