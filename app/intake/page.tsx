import Link from "next/link";
import { Boxes, Database, FileSpreadsheet, PackagePlus, Tags, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission, hasPageRole } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function IntakeHubPage() {
  const [canInventoryWrite, canStockWrite, canUseLegacyImport] = await Promise.all([
    hasPagePermission("inventory.write"),
    hasPagePermission("stock.write"),
    hasPageRole("ADMIN"),
  ]);
  if (!canInventoryWrite && !canStockWrite) {
    return <ForbiddenPanel message="Inventory intake requires IT Staff or Admin access." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Intake"
        description="Create new inventory in the app instead of adding rows to the old workbook. Choose the fastest path for what arrived today."
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <IntakeCard
          href="/intake/assets/new"
          title="Single Asset Intake"
          description="One serialized device with full details and recommended photos now."
          icon={PackagePlus}
          disabled={!canInventoryWrite}
        />
        <IntakeCard
          href="/intake/assets/bulk"
          title="Bulk Asset Intake"
          description="Create many serialized records quickly. Add photos later through compliance queues."
          icon={Boxes}
          disabled={!canInventoryWrite}
        />
        <IntakeCard
          href="/intake/stock"
          title="Stock Intake"
          description="Receive quantity-based items like mice, keyboards, cables, chargers, ribbons, and labels."
          icon={Tags}
          disabled={!canStockWrite}
        />
        <IntakeCard
          href="/import/legacy-sheet"
          title="Legacy Import"
          description="Old Excel migration/admin-only. New inventory should use Intake."
          icon={FileSpreadsheet}
          disabled={!canUseLegacyImport}
          secondary
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-950">What belongs where?</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold text-slate-950">Serialized assets</p>
            <p className="mt-1">Laptops, iPods, sleds, scanners, printers, scales, monitors, and other items tracked one-by-one.</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold text-slate-950">Stock items</p>
            <p className="mt-1">Quantity-based consumables and peripherals. Do not create one asset record per mouse or cable unless serialized.</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold text-slate-950">Legacy workbook</p>
            <p className="mt-1">Use only for migration/admin tasks. The app is the source of truth for new inventory.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/devices" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <Database size={16} />
          Browse Inventory
        </Link>
        <Link href="/labels" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <Tags size={16} />
          Generate Labels
        </Link>
      </div>
    </div>
  );
}

function IntakeCard({
  href,
  title,
  description,
  icon: Icon,
  disabled,
  secondary = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const content = (
    <div className={`h-full rounded-lg border p-4 shadow-sm ${secondary ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-3 ${secondary ? "bg-amber-100 text-amber-900" : "bg-slate-950 text-white"}`}>
          <Icon size={22} />
        </div>
        <div>
          <h2 className="font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>
      <div className={`mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-md px-4 text-sm font-semibold ${disabled ? "bg-slate-100 text-slate-400" : "bg-slate-950 text-white"}`}>
        {disabled ? "Not allowed" : "Open"}
      </div>
    </div>
  );
  return disabled ? <div aria-disabled="true">{content}</div> : <Link href={href}>{content}</Link>;
}
