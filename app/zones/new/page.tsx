import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ZoneForm } from "@/components/zone-form";

export const dynamic = "force-dynamic";

export default async function NewZonePage() {
  const maps = await prisma.warehouseMap.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <PageHeader title="Add Zone" description="Create a warehouse zone for manual location grouping." />
      <div className="rounded-lg border border-slate-200 bg-white p-4"><ZoneForm maps={maps} /></div>
    </div>
  );
}
