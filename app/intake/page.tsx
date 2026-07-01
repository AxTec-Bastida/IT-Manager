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
import { createTranslator } from "@/lib/i18n";
import { getLocaleFromCookies } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function IntakeHubPage() {
  const locale = await getLocaleFromCookies();
  const text = createTranslator(locale, "intake");
  const common = createTranslator(locale, "common");
  const [canInventoryWrite, canStockWrite, canUseLegacyImport] = await Promise.all([
    hasPagePermission("inventory.write"),
    hasPagePermission("stock.write"),
    hasPageRole("ADMIN"),
  ]);
  if (!canInventoryWrite && !canStockWrite) {
    return <ForbiddenPanel message={text("forbidden")} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={text("title")}
        description={text("description")}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <IntakeCard
          href="/intake/assets/new"
          title={text("addOneAsset")}
          description={text("addOneAssetDescription")}
          icon={PackagePlus}
          disabled={!canInventoryWrite}
          actionLabel={common("open")}
          disabledLabel={common("notAllowed")}
        />
        <IntakeCard
          href="/intake/assets/bulk"
          title={text("bulkReceive")}
          description={text("bulkReceiveDescription")}
          icon={Boxes}
          disabled={!canInventoryWrite}
          actionLabel={common("open")}
          disabledLabel={common("notAllowed")}
        />
        <IntakeCard
          href="/intake/pair"
          title={text("pairCompanionDevices")}
          description={text("pairCompanionDevicesDescription")}
          icon={Handshake}
          disabled={!canInventoryWrite}
          actionLabel={common("open")}
          disabledLabel={common("notAllowed")}
        />
        <IntakeCard
          href="/audits"
          title={text("inventoryAudit")}
          description={text("inventoryAuditDescription")}
          icon={ClipboardList}
          disabled={!canInventoryWrite}
          actionLabel={common("open")}
          disabledLabel={common("notAllowed")}
        />
        <IntakeCard
          href="/photos/compliance"
          title={text("photoFollowUp")}
          description={text("photoFollowUpDescription")}
          icon={Camera}
          disabled={!canInventoryWrite}
          actionLabel={common("open")}
          disabledLabel={common("notAllowed")}
        />
        <IntakeCard
          href="/labels"
          title={text("printLabels")}
          description={text("printLabelsDescription")}
          icon={Tags}
          disabled={!canInventoryWrite}
          actionLabel={common("open")}
          disabledLabel={common("notAllowed")}
        />
        {canUseLegacyImport && (
          <IntakeCard
            href="/import/legacy-sheet"
            title={text("importHistory")}
            description={text("importHistoryDescription")}
            icon={FileSpreadsheet}
            disabled={false}
            secondary
            actionLabel={common("open")}
            disabledLabel={common("notAllowed")}
          />
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-950">{text("whatsDifference")}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold text-slate-950">{text("bulkReceiveShort")}</p>
            <p className="mt-1">{text("bulkReceiveShortDescription")}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold text-slate-950">{text("auditShort")}</p>
            <p className="mt-1">{text("auditShortDescription")}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold text-slate-950">{text("pairShort")}</p>
            <p className="mt-1">{text("pairShortDescription")}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold text-slate-950">{text("singleVsBulk")}</p>
            <p className="mt-1">{text("singleVsBulkDescription")}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/devices" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <Database size={16} />
          {text("browseInventory")}
        </Link>
        <Link href="/stock" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <Tags size={16} />
          {text("stockroom")}
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
  actionLabel,
  disabledLabel,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  disabled?: boolean;
  secondary?: boolean;
  actionLabel: string;
  disabledLabel: string;
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
        {disabled ? disabledLabel : actionLabel}
      </div>
    </div>
  );
  return disabled ? <div aria-disabled="true">{content}</div> : <Link href={href}>{content}</Link>;
}
