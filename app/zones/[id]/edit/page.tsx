import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ZoneForm } from "@/components/zone-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditZonePage({ params }: Props) {
  const { id } = await params;
  const [zone, maps] = await Promise.all([
    prisma.locationZone.findUnique({ where: { id } }),
    prisma.warehouseMap.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!zone) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${zone.name}`} description="Update zone details and map assignment." />
      <div className="rounded-lg border border-slate-200 bg-white p-4"><ZoneForm zone={zone} maps={maps} /></div>
    </div>
  );
}
