import Link from "next/link";
import { Info, Plus, Search, SlidersHorizontal } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { WarehouseMapView } from "@/components/warehouse-map-view";
import { MapConfigForm } from "@/components/map-config-form";
import { Badge } from "@/components/badge";
import { categoryLabels, categoryOptions } from "@/lib/constants";
import { isLegacyUnifiSyncEnabled } from "@/lib/unifi-disabled";
import { buildAnchorDisplayPath } from "@/lib/map-anchors";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function MapPage({ searchParams }: Props) {
  const params = await searchParams;
  const legacyUnifiEnabled = isLegacyUnifiSyncEnabled();
  const [activeMap, maps, allAccessPoints, histories, snapshots, devices] = await Promise.all([
    prisma.warehouseMap.findFirst({ where: { active: true }, orderBy: { updatedAt: "desc" } }),
    prisma.warehouseMap.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.accessPointMapLocation.findMany({ orderBy: [{ active: "desc" }, { displayPath: "asc" }, { locationLabel: "asc" }] }),
    prisma.assetLocationHistory.findMany({
      include: { asset: { include: { expectedLocationZone: true, alerts: { where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } }, orderBy: { lastSeenAt: "desc" }, take: 3 } } }, apMapLocation: { include: { locationZone: true } } },
      orderBy: { seenAt: "desc" },
      take: params.history === "5" && params.asset ? 5 : 100,
    }),
    legacyUnifiEnabled ? prisma.unifiClientSnapshot.findMany({ orderBy: { syncedAt: "desc" }, take: 500 }) : Promise.resolve([]),
    prisma.device.findMany({ select: { id: true, name: true, assetTag: true, serialNumber: true }, orderBy: { name: "asc" }, take: 750 }),
  ]);
  const activeAccessPoints = allAccessPoints.filter((ap) => ap.active);

  const latestSnapshotByAssetId = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    if (snapshot.assetId && !latestSnapshotByAssetId.has(snapshot.assetId)) latestSnapshotByAssetId.set(snapshot.assetId, snapshot);
  }

  const filteredHistories = histories.filter((history) => {
    const snapshot = latestSnapshotByAssetId.get(history.assetId);
    const assigned = history.asset.assignedTo?.toLowerCase() ?? "";
    const location = history.locationLabel.toLowerCase();
    const matchesAsset = !params.asset || history.assetId === params.asset;
    const matchesCategory = !params.category || history.asset.category === params.category;
    const matchesMissing = params.missing !== "true" || history.asset.status === "MISSING";
    const matchesOnline = params.online !== "true" || snapshot?.online === true;
    const matchesAssigned = !params.assignedTo || assigned.includes(params.assignedTo.toLowerCase());
    const matchesLocation = !params.location || location.includes(params.location.toLowerCase());
    return matchesAsset && matchesCategory && matchesMissing && matchesOnline && matchesAssigned && matchesLocation;
  });

  const historiesToShow = params.asset && params.history === "5" ? filteredHistories.slice(0, 5) : latestPerAsset(filteredHistories);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse map"
        description="Visual floor plan for location anchors, last-scanned asset pins, and movement alerts. This is approximate warehouse context, not GPS."
        action={
          <Link href="/map/ap-locations/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            <Plus size={16} />
            Add location anchor
          </Link>
        }
      />

      <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 shrink-0" size={18} />
          <div className="space-y-2">
            <h2 className="font-semibold">How Map and Zones work together</h2>
            <p>
              The map is the visual warehouse floor plan. Location anchors are points on that map, such as an AP, doorway,
              bench, rack, or cage. Zones are logical sectors like Packing, Receiving, IT Cage, Returns, Shipping, or
              Co-Production. Assign anchors to zones so fixed/static assets can be compared against their expected zone.
            </p>
            <p>
              Asset pins use stored manual scan/location history and enabled legacy local data only. If a fixed asset is
              recorded in a different zone than expected, the app can raise a FIXED_ASSET_MOVED alert for review.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/zones" className="inline-flex min-h-10 items-center justify-center rounded-md bg-white px-3 font-semibold text-sky-950 ring-1 ring-sky-200">
                Open Zones
              </Link>
              <Link href="/admin/master-data" className="inline-flex min-h-10 items-center justify-center rounded-md bg-white px-3 font-semibold text-sky-950 ring-1 ring-sky-200">
                Admin Master Data
              </Link>
            </div>
          </div>
        </div>
      </section>

      <form className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
        <label className="relative block">
          <Search className="absolute left-3 top-4 text-slate-400" size={16} />
          <select name="asset" defaultValue={params.asset ?? ""} className="min-h-14 w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-base sm:min-h-12 sm:text-sm">
            <option value="">Search / select recent asset</option>
            {devices.map((device) => <option key={device.id} value={device.id}>{[device.name, device.assetTag, device.serialNumber].filter(Boolean).join(" / ")}</option>)}
          </select>
        </label>
        <details className="rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex min-h-12 items-center justify-between px-3 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} />Map filters</span>
            <span className="text-xs text-slate-500">Missing, category, location</span>
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-3 xl:grid-cols-6">
            <select name="category" defaultValue={params.category ?? ""} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base sm:text-sm">
              <option value="">All categories</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
            </select>
            <input name="assignedTo" defaultValue={params.assignedTo ?? ""} placeholder="Assigned user/dept" className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
            <input name="location" defaultValue={params.location ?? ""} placeholder="Location label" className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
            <select name="history" defaultValue={params.history ?? ""} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base sm:text-sm">
              <option value="">Latest per asset</option>
              <option value="5">Last 5 for selected asset</option>
            </select>
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="missing" value="true" type="checkbox" defaultChecked={params.missing === "true"} />
              Missing only
            </label>
            {legacyUnifiEnabled ? <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="online" value="true" type="checkbox" defaultChecked={params.online === "true"} />
              Online only
            </label> : null}
            <button className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white md:col-span-3 xl:col-span-6">Apply filters</button>
          </div>
        </details>
      </form>

      <WarehouseMapView
        map={activeMap}
        accessPoints={activeAccessPoints}
        histories={historiesToShow}
        snapshotsByAssetId={latestSnapshotByAssetId}
        showMovement={params.asset != null && params.history === "5"}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-950">Location anchors</h2>
            <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{activeAccessPoints.length} active</Badge>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {allAccessPoints.map((ap) => {
              const path = buildAnchorDisplayPath(ap);
              return (
                <div key={ap.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-950">{path} {!ap.active ? <span className="text-slate-400">(inactive)</span> : null}</p>
                    <p className="text-slate-500">{ap.apName} / {ap.apMac} / {ap.x}%, {ap.y}%</p>
                  </div>
                  <Link href={`/map/ap-locations/${ap.id}/edit`} className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">Edit</Link>
                </div>
              );
            })}
            {allAccessPoints.length === 0 ? (
              <div className="py-3 text-sm text-slate-600">
                <p className="font-medium text-slate-950">No location anchors configured yet.</p>
                <p className="mt-1">Create anchors for important places like Packing, Receiving, IT Cage, Returns, Shipping, or Co-Production. Anchors can then be assigned to zones.</p>
                <Link href="/map/ap-locations/new" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100">
                  Add first location anchor
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <MapConfigForm />
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <h2 className="font-semibold text-slate-950">Configured maps</h2>
            <div className="mt-3 space-y-2">
              {maps.map((map) => (
                <div key={map.id} className="rounded-md bg-slate-50 p-3">
                  <p className="font-medium text-slate-950">{map.name} {map.active ? "(active)" : ""}</p>
                  <p>{map.imageUrl}</p>
                  <p className="text-xs text-slate-500">{map.uploadedStoredFilename ? "Uploaded map image" : "Manual path / legacy map reference"}</p>
                </div>
              ))}
              {maps.length === 0 ? (
                <div className="space-y-2">
                  <p>No custom warehouse layout image is active yet.</p>
                  <p>Using the sample map at /warehouse-map.svg. Upload the warehouse floor plan when ready; anchors and zones can still be configured before that.</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function latestPerAsset<T extends { assetId: string; seenAt: Date }>(histories: T[]) {
  const seen = new Set<string>();
  const latest: T[] = [];
  for (const history of histories) {
    if (seen.has(history.assetId)) continue;
    seen.add(history.assetId);
    latest.push(history);
  }
  return latest;
}
