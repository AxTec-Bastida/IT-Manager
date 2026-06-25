import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { IntakeSingleAssetForm } from "@/components/intake-single-asset-form";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function AddOneAssetPage() {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Adding assets requires IT Staff or Admin access." />;
  const [facturas, controlledValues] = await Promise.all([
    prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], take: 100 }),
    prisma.controlledValue.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add One Asset"
        description="Create one serialized device with full details. Use Bulk Receive for many devices at once."
        action={
          <Link href="/intake" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <ArrowLeft size={16} />
            Intake hub
          </Link>
        }
      />
      <IntakeSingleAssetForm facturas={facturas} controlledValues={controlledValues} />
    </div>
  );
}
