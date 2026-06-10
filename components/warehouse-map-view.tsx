import Link from "next/link";
import type { AccessPointMapLocation, AssetLocationHistory, Device, UnifiClientSnapshot, WarehouseMap } from "@prisma/client";
import { Badge } from "@/components/badge";
import { statusLabels, statusTone } from "@/lib/constants";
import { buildAnchorDisplayPath } from "@/lib/map-anchors";

type MapHistory = AssetLocationHistory & {
  asset: Pick<Device, "id" | "name" | "status" | "assignedTo" | "category"> & {
    expectedLocationZone?: { name: string } | null;
    alerts?: Array<{ id: string; title: string; severity: string; source: string; status: string }>;
  };
  apMapLocation?: { locationZone?: { name: string } | null } | null;
};

type WarehouseMapViewProps = {
  map: WarehouseMap | null;
  accessPoints: AccessPointMapLocation[];
  histories: MapHistory[];
  snapshotsByAssetId?: Map<string, UnifiClientSnapshot>;
  showMovement?: boolean;
};

export function WarehouseMapView({ map, accessPoints, histories, snapshotsByAssetId = new Map(), showMovement = false }: WarehouseMapViewProps) {
  const imageUrl = map?.imageUrl ?? "/warehouse-map.svg";
  const movementPoints = histories.slice(0, 5).map((history) => `${history.x},${history.y}`).join(" ");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="relative min-h-[62vh] w-full bg-slate-50 sm:aspect-[5/3] sm:min-h-[420px] lg:min-h-[520px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={map?.name ?? "Warehouse floor map"} className="absolute inset-0 h-full w-full object-contain" />
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {showMovement && movementPoints ? <polyline points={movementPoints} fill="none" stroke="#2563eb" strokeWidth="0.6" strokeDasharray="1.2 1" /> : null}
          </svg>

          {accessPoints.map((ap) => {
            const path = buildAnchorDisplayPath(ap);
            return (
              <div
                key={ap.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${ap.x}%`, top: `${ap.y}%` }}
                title={`${ap.apName} - ${path}`}
              >
                <div className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-slate-950 text-xs font-bold text-white shadow-md">LOC</div>
                <div className="mt-1 hidden max-w-36 rounded bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow sm:block">{path}</div>
              </div>
            );
          })}

          {histories.map((history, index) => (
            <Link
              key={history.id}
              href={`/devices/${history.assetId}`}
              className="absolute -translate-x-1/2 -translate-y-full"
              style={{ left: `${history.x}%`, top: `${history.y}%` }}
              title={`${history.asset.name} at ${history.locationLabel} - ${history.seenAt.toLocaleString()}`}
            >
              <div className={index === 0 ? "flex size-10 items-center justify-center rounded-full border-2 border-white bg-rose-600 text-sm font-bold text-white shadow-lg" : "flex size-8 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-xs font-bold text-white shadow-md"}>
                {index + 1}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Last known locations</h2>
          <div className="mt-3 space-y-3">
            {histories.map((history, index) => {
              const snapshot = snapshotsByAssetId.get(history.assetId);
              const importantAlert = history.asset.alerts?.[0];
              return (
                <div key={history.id} className="rounded-md bg-slate-50 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/devices/${history.assetId}`} className="font-semibold text-slate-950 hover:underline">
                        {index + 1}. {history.asset.name}
                      </Link>
                      <p className="text-slate-600">{history.locationLabel}</p>
                    </div>
                    <Badge className={statusTone[history.asset.status]}>{statusLabels[history.asset.status]}</Badge>
                  </div>
                  <p className="mt-2 text-slate-500">{history.apName}</p>
                  <p className="text-slate-500">Expected: {history.asset.expectedLocationZone?.name ?? "Not set"} / Actual: {history.apMapLocation?.locationZone?.name ?? history.locationLabel}</p>
                  {importantAlert ? <Link href={`/alerts?assetId=${history.assetId}`} className="mt-2 block rounded-md bg-amber-50 p-2 text-xs font-semibold text-amber-900">{importantAlert.severity}: {importantAlert.title}</Link> : null}
                  <p className="text-slate-500">{history.seenAt.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Network status: {snapshot?.online ? "online" : snapshot ? "offline" : "unknown"}
                    {history.signalStrength != null ? ` / ${history.signalStrength} dBm` : ""}
                  </p>
                </div>
              );
            })}
            {histories.length === 0 ? <p className="text-sm text-slate-500">No mapped asset location history matches the current filters.</p> : null}
          </div>
        </section>
      </aside>
    </div>
  );
}
