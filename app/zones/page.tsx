import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  const zones = await prisma.locationZone.findMany({ include: { accessPoints: true, expectedAssets: true }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <div className="space-y-6">
      <PageHeader title="Location Zones" description="Group mapped APs into warehouse zones for fixed/static asset movement alerts." action={<Link href="/zones/new" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"><Plus size={16} />Add zone</Link>} />
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {zones.map((zone) => (
          <Link key={zone.id} href={`/zones/${zone.id}`} className="rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-950">{zone.name}</h2>
              <Badge className={zone.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}>{zone.active ? "Active" : "Inactive"}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-500">{zone.description || "No description"}</p>
            <p className="mt-3 text-sm text-slate-600">{zone.accessPoints.length} APs • {zone.expectedAssets.length} expected assets</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
