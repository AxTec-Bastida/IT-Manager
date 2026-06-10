import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { IntakeSingleAssetForm } from "@/components/intake-single-asset-form";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function SingleAssetIntakePage() {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Single asset intake requires IT Staff or Admin access." />;
  const facturas = await prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], take: 100 });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Single Asset Intake"
        description="Create one serialized asset with details and optional evidence photos now."
        action={
          <Link href="/intake" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <ArrowLeft size={16} />
            Intake hub
          </Link>
        }
      />
      <IntakeSingleAssetForm facturas={facturas} />
    </div>
  );
}
