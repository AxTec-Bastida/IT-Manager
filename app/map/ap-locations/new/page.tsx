import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ApLocationForm } from "@/components/ap-location-form";

export const dynamic = "force-dynamic";

export default async function NewApLocationPage() {
  const [maps, zones] = await Promise.all([
    prisma.warehouseMap.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.locationZone.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Add location anchor" description="Place a warehouse location anchor on the map using x/y percentages. Legacy AP sync is disabled by default." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <ApLocationForm maps={maps} zones={zones} />
      </div>
    </div>
  );
}
