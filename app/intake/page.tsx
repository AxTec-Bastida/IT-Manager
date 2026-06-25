import Link from "next/link";
import {
  Boxes,
  ClipboardList,
  Database,
  FileSpreadsheet,
  Handshake,
  PackagePlus,
  Camera,
  Tags,
  type LucideIcon,
} from "lucide-react";
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
        description="Choose the fastest path for what needs to be done today."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <IntakeCard
          href="/intake/assets/new"
          title="Add One Asset"
          description="Use when one laptop, printer, sled, scanner, iPod, iPhone, access point, scale, or other serialized device needs to be created now."
          icon={PackagePlus}
          disabled={!canInventoryWrite}
        />
        <IntakeCard
          href="/intake/assets/bulk"
          title="Bulk Receive Serialized Assets"
          description="Use when receiving many serialized devices and matching internal asset tags to serial numbers."
          icon={Boxes}
          disabled={!canInventoryWrite}
        />
        <IntakeCard
          href="/intake/pair"
          title="Pair Companion Devices"
          description="Use when pairing existing devices, such as a sled with an iPod or iPhone. Both devices must already exist in inventory."
          icon={Handshake}
          disabled={!canInventoryWrite}
        />
        <IntakeCard
          href="/audits"
          title="Inventory Count / Audit"
          description="Use when walking the warehouse and checking existing assets from a count sheet. Different from Bulk Receive — this checks assets that already exist, not new arrivals."
          icon={ClipboardList}
          disabled={!canInventoryWrite}
        />
        <IntakeCard
          href="/photos/compliance"
          title="Photo Follow-Up"
          description="Use after intake or counts to capture missing overview, label, or damage photos for assets that were created without photos."
          icon={Camera}
          disabled={!canInventoryWrite}
        />
        <IntakeCard
          href="/labels"
          title="Print Labels"
          description="Print labels for new, selected, or missing-label assets."
          icon={Tags}
          disabled={!canInventoryWrite}
        />
        {canUseLegacyImport && (
          <IntakeCard
            href="/import/legacy-sheet"
            title="Import History"
            description="Admin only. Review previous intake, import, or legacy workbook batches."
            icon={FileSpreadsheet}
            disabled={false}
            secondary
          />
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-950">What&apos;s the difference?</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold text-slate-950">Bulk Receive Serialized Assets</p>
            <p className="mt-1">Use when a shipment of new devices arrives and you need to create asset records and match serial numbers. Creates new inventory.</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold text-slate-950">Inventory Count / Audit</p>
            <p className="mt-1">Use when walking the warehouse to verify what is already in the system. Checks existing inventory, does not create new records.</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold text-slate-950">Pair Companion Devices</p>
            <p className="mt-1">Use when both a sled and an iPod/iPhone already exist in inventory and you want to link them together. Scan or search for both devices.</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold text-slate-950">Add One Asset vs. Bulk Receive</p>
            <p className="mt-1">Add One Asset is for a single device with full details now. Bulk Receive is for many devices where you may fill serials later.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/devices" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <Database size={16} />
          Browse Inventory
        </Link>
        <Link href="/stock" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <Tags size={16} />
          Stockroom
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
    <div className={`h-full rounded-lg border p-4 shadow-sm transition-colors ${
      secondary ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"
    }`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rounded-lg p-3 ${
          secondary ? "bg-amber-100 text-amber-900" : "bg-slate-950 text-white"
        }`}>
          <Icon size={22} />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>
      <div className={`mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md px-4 text-sm font-semibold ${
        disabled ? "bg-slate-100 text-slate-400" : "bg-slate-950 text-white"
      }`}>
        {disabled ? "Not allowed" : "Open"}
      </div>
    </div>
  );
  return disabled ? <div aria-disabled="true">{content}</div> : <Link href={href}>{content}</Link>;
}
