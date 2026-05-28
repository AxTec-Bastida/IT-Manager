import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ApLocationForm } from "@/components/ap-location-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditApLocationPage({ params }: Props) {
  const { id } = await params;
  const [accessPoint, maps, zones] = await Promise.all([
    prisma.accessPointMapLocation.findUnique({ where: { id } }),
    prisma.warehouseMap.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.locationZone.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!accessPoint) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${accessPoint.apName}`} description="Update the AP label, MAC, map, and approximate marker position." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <ApLocationForm accessPoint={accessPoint} maps={maps} zones={zones} />
      </div>
    </div>
  );
}
