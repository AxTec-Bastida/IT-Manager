import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { IntakeBulkAssetsForm } from "@/components/intake-bulk-assets-form";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function BulkAssetIntakePage() {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Bulk asset intake requires IT Staff or Admin access." />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Asset Intake"
        description="Create many serialized asset records quickly. Use this for sleds, scanners, monitors, and similar batches."
        action={
          <Link href="/intake" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <ArrowLeft size={16} />
            Intake hub
          </Link>
        }
      />
      <IntakeBulkAssetsForm />
    </div>
  );
}
