import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { MaintenanceForm } from "@/components/maintenance-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function NewMaintenancePage({ params }: Props) {
  const { id } = await params;
  const [asset, stockItems] = await Promise.all([
    prisma.device.findUnique({ where: { id } }),
    prisma.stockItem.findMany({ where: { active: true }, orderBy: [{ quantityOnHand: "desc" }, { name: "asc" }] }),
  ]);
  if (!asset) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Add Maintenance" description={`Record service, cleaning, supply replacement, or repair for ${asset.name}.`} />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <MaintenanceForm asset={asset} stockItems={stockItems} />
      </div>
    </div>
  );
}
