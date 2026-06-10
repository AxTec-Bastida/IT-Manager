import Link from "next/link";
import { MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { categoryLabels, statusLabels, statusTone } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function MissingAssetsPage() {
  const missingAssets = await prisma.device.findMany({
    where: { status: "MISSING" },
    include: {
      locationHistory: { orderBy: { seenAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Missing assets" description="Assets marked missing with their inventory location and latest stored location update." />
      <div className="grid gap-3">
        {missingAssets.map((asset) => {
          const lastLocation = asset.locationHistory[0];
          return (
            <article key={asset.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-950">{asset.name}</h2>
                  <p className="font-mono text-sm text-slate-600">{asset.ipAddress}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {categoryLabels[asset.category]} • Assigned to {asset.assignedTo || "unassigned"}
                  </p>
                </div>
                <Badge className={statusTone[asset.status]}>{statusLabels[asset.status]}</Badge>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-slate-500">Last seen</p>
                  <p className="font-medium text-slate-950">{lastLocation?.seenAt.toLocaleString() ?? asset.lastSeenAt?.toLocaleString() ?? "No location updates yet"}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-slate-500">Last location</p>
                  <p className="font-medium text-slate-950">{lastLocation?.locationLabel ?? asset.location ?? "No location updates yet"}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-slate-500">Current status</p>
                  <p className="font-medium text-slate-950">{statusLabels[asset.status]}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:flex">
                <Link href={`/map?asset=${asset.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                  <MapPin size={16} />
                  View on Map
                </Link>
                <Link href={`/map?asset=${asset.id}&history=5`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  Show Last 5 Locations
                </Link>
              </div>
            </article>
          );
        })}
        {missingAssets.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No assets are currently marked missing.</div> : null}
      </div>
    </div>
  );
}
