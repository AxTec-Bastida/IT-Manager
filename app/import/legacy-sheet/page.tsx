import { PageHeader } from "@/components/page-header";
import { LegacyImportPanel } from "@/components/legacy-import-panel";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPageRole } from "@/lib/page-permissions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LegacySheetImportPage() {
  if (!(await hasPageRole("ADMIN"))) return <ForbiddenPanel message="Legacy imports are admin-only. Use Data Quality for review-only cleanup." />;
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Legacy Excel Import"
        description="Old Excel/Sheet migration only. New inventory should be created through Intake."
        action={
          <Link href="/intake" className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Open Intake
          </Link>
        }
      />
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">Legacy migration/admin-only</p>
        <p className="mt-1">Use this page only for old workbook migration and controlled previews. For new laptops, sleds, phones, printers, scales, and stock received today, use `/intake` so the app remains the source of truth.</p>
      </section>
      <LegacyImportPanel />
    </div>
  );
}
