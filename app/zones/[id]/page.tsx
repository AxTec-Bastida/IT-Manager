import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ZoneDetailPage({ params }: Props) {
  const { id } = await params;
  const zone = await prisma.locationZone.findUnique({
    where: { id },
    include: {
      map: true,
      accessPoints: { orderBy: { locationLabel: "asc" } },
      expectedAssets: { orderBy: { name: "asc" } },
    },
  });
  if (!zone) notFound();

  const movementAlerts = await prisma.alert.findMany({
    where: { type: "FIXED_ASSET_MOVED", status: { in: ["OPEN", "ACKNOWLEDGED"] }, metadata: { contains: zone.id } },
    include: { asset: true },
    orderBy: { lastSeenAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={zone.name}
        description={zone.description || "Warehouse location zone for expected fixed/static asset placement."}
        action={
          <Link href={`/zones/${zone.id}/edit`} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
            <Edit size={16} />
            Edit
          </Link>
        }
      />

      <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        This zone groups map anchors with assets expected to stay here. FIXED_ASSET_MOVED alerts appear when a fixed/static asset is recorded outside this expected zone and can auto-resolve when it returns.
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Zone info</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-slate-500">Floor</dt><dd>{zone.floorName || "-"}</dd></div>
            <div><dt className="text-slate-500">Map</dt><dd>{zone.map?.name || "-"}</dd></div>
            <div><dt className="text-slate-500">Color</dt><dd>{zone.color || "-"}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="font-semibold text-slate-950">Map anchors assigned to zone</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {zone.accessPoints.map((ap) => (
              <Link key={ap.id} href={`/map/ap-locations/${ap.id}/edit`} className="block py-3 text-sm hover:bg-slate-50">
                <p className="font-medium">{ap.locationLabel}</p>
                <p className="text-slate-500">{ap.apName} / {ap.apMac}</p>
              </Link>
            ))}
            {zone.accessPoints.length === 0 ? <p className="text-sm text-slate-500">No map anchors assigned to this zone.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Assets expected in zone</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {zone.expectedAssets.map((asset) => (
              <Link key={asset.id} href={`/devices/${asset.id}`} className="block py-3 text-sm hover:bg-slate-50">
                <p className="font-medium">{asset.name}</p>
                <p className="text-slate-500">{asset.assetTag || "No tag"}</p>
              </Link>
            ))}
            {zone.expectedAssets.length === 0 ? <p className="text-sm text-slate-500">No assets expect this zone yet.</p> : null}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Recent movement alerts</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {movementAlerts.map((alert) => (
              <Link key={alert.id} href="/alerts?type=FIXED_ASSET_MOVED" className="block py-3 text-sm hover:bg-slate-50">
                <p className="font-medium">{alert.title}</p>
                <p className="text-slate-500">{alert.asset?.name} / {alert.lastSeenAt.toLocaleString()}</p>
              </Link>
            ))}
            {movementAlerts.length === 0 ? <p className="text-sm text-slate-500">No open movement alerts for this zone.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
