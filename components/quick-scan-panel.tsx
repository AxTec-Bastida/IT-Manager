"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Camera, ExternalLink, ImagePlus, MapPin, Package, Plus, Search, TimerReset, Wrench } from "lucide-react";
import { CameraScanner } from "@/components/camera-scanner";
import { Badge } from "@/components/badge";
import { categoryLabels, conditionLabels, conditionTone, statusLabels, statusTone } from "@/lib/constants";
import type { ParsedScan } from "@/lib/scan-label";

type LookupDevice = {
  id: string;
  assetTag: string | null;
  name: string;
  ipAddress: string | null;
  macAddress: string | null;
  serialNumber: string | null;
  category: string;
  status: string;
  condition: string;
  location: string | null;
  employee?: { fullName: string } | null;
  assignedTo?: string | null;
  warrantyExpiresAt?: string | null;
  alerts?: Array<{ id: string; title: string; severity: string; source: string; status: string }>;
  locationHistory?: Array<{ locationLabel: string; seenAt: string; apName: string; apMapLocation?: { locationZone?: { name: string } | null } | null }>;
};

type LookupStockItem = {
  id: string;
  name: string;
  sku: string | null;
  itemType: string;
  quantityOnHand: number;
  minimumQuantity: number;
  storageLocation: string | null;
};

export function QuickScanPanel() {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedScan | null>(null);
  const [devices, setDevices] = useState<LookupDevice[]>([]);
  const [stockItems, setStockItems] = useState<LookupStockItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (value: string) => {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/scan-lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value }),
    });
    const data = await response.json();
    setLoading(false);
    setParsed(data.parsed);
    setDevices(data.devices ?? []);
    setStockItems(data.stockItems ?? []);
    setScannerOpen(false);
    const totalMatches = (data.devices ?? []).length + (data.stockItems ?? []).length;
    if (totalMatches === 1) setMessage("One matching record found.");
    if (totalMatches === 0) setMessage("No exact match found. Search inventory, stock, or create a new record with the scanned value.");
  }, []);

  async function markSeen(id: string) {
    await fetch(`/api/devices/${id}/seen`, { method: "POST" });
    setMessage("Asset marked seen just now.");
    router.refresh();
  }

  const addHref = parsed
    ? `/devices/new?${new URLSearchParams({
        ...(parsed.ipAddress ? { ipAddress: parsed.ipAddress } : {}),
        ...(parsed.macAddress ? { macAddress: parsed.macAddress } : {}),
        ...(parsed.serialNumber ? { serialNumber: parsed.serialNumber } : {}),
        ...(parsed.deviceName ? { name: parsed.deviceName } : {}),
        ...(parsed.assetTag ? { assetTag: parsed.assetTag } : {}),
      }).toString()}`
    : "/devices/new";

  return (
    <div className="space-y-5">
      <CameraAccessNotice />
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="flex min-h-20 w-full items-center justify-center gap-3 rounded-lg bg-slate-950 px-4 text-lg font-semibold text-white hover:bg-slate-800"
        >
          <Camera size={26} />
          Start camera scan
        </button>
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const value = String(formData.get("manual") ?? "");
            if (value) lookup(value);
          }}
        >
          <input name="manual" className="min-h-14 rounded-md border border-slate-300 px-3 text-base" placeholder="Type, paste, or scan with handheld scanner" />
          <button className="min-h-14 rounded-md border border-slate-300 px-5 text-base font-semibold text-slate-700 hover:bg-slate-100">Search</button>
        </form>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </section>

      {parsed ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Scanned value</h2>
          <p className="mt-2 break-all rounded-md bg-slate-50 p-3 font-mono text-sm text-slate-700">{parsed.raw}</p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {parsed.ipAddress ? <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">IP</span><p className="font-mono">{parsed.ipAddress}</p></div> : null}
            {parsed.macAddress ? <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">MAC</span><p className="font-mono">{parsed.macAddress}</p></div> : null}
            {parsed.serialNumber ? <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Serial</span><p>{parsed.serialNumber}</p></div> : null}
            {parsed.assetTag ? <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Asset tag</span><p>{parsed.assetTag}</p></div> : null}
            {parsed.deviceName ? <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Name</span><p>{parsed.deviceName}</p></div> : null}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link href={`/devices?q=${encodeURIComponent(parsed.query)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12">
              <Search size={18} />
              Search assets
            </Link>
            <Link href={`/stock?q=${encodeURIComponent(parsed.query)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12">
              <Package size={18} />
              Search stock
            </Link>
            <Link href={addHref} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 sm:min-h-12">
              <Plus size={18} />
              Add asset
            </Link>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {loading ? <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Looking up inventory and stock...</div> : null}
        {devices.map((device) => (
          <article key={device.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-950">{device.name}</h2>
            <p className="font-mono text-sm text-slate-600">{device.assetTag || device.ipAddress || device.serialNumber || "No tag"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className={statusTone[device.status as keyof typeof statusTone]}>{statusLabels[device.status as keyof typeof statusLabels] ?? device.status.replaceAll("_", " ")}</Badge>
              <Badge className={conditionTone[device.condition as keyof typeof conditionTone]}>{conditionLabels[device.condition as keyof typeof conditionLabels] ?? device.condition.replaceAll("_", " ")}</Badge>
              <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{categoryLabels[device.category as keyof typeof categoryLabels] ?? device.category}</Badge>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-3">
                <span className="text-slate-500">Location</span>
                <p className="font-medium text-slate-950">{device.location || "No location"}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <span className="text-slate-500">Assigned</span>
                <p className="font-medium text-slate-950">{device.employee?.fullName || device.assignedTo || "Unassigned"}</p>
              </div>
              {device.ipAddress ? (
                <div className="rounded-md bg-slate-50 p-3">
                  <span className="text-slate-500">IP</span>
                  <p className="font-mono font-medium text-slate-950">{device.ipAddress}</p>
                </div>
              ) : null}
              {device.macAddress ? (
                <div className="rounded-md bg-slate-50 p-3">
                  <span className="text-slate-500">MAC</span>
                  <p className="break-all font-mono font-medium text-slate-950">{device.macAddress}</p>
                </div>
              ) : null}
              {device.locationHistory?.[0] ? (
                <div className="rounded-md bg-slate-50 p-3 sm:col-span-2">
                  <span className="text-slate-500">Last known</span>
                  <p className="font-medium text-slate-950">{device.locationHistory[0].apMapLocation?.locationZone?.name || device.locationHistory[0].locationLabel}</p>
                </div>
              ) : null}
            </div>
          </div>
            </div>
            {device.alerts?.length ? (
              <div className="mt-3 space-y-2">
                {device.alerts.map((alert) => (
                  <Link key={alert.id} href={`/alerts?assetId=${device.id}`} className="flex min-h-12 items-center gap-2 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                    <AlertTriangle size={16} />
                    {alert.severity}: {alert.title}
                  </Link>
                ))}
              </div>
            ) : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href={`/devices/${device.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                <ExternalLink size={17} />
                Open Asset
              </Link>
              <button type="button" onClick={() => markSeen(device.id)} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <TimerReset size={17} />
                Mark seen
              </button>
              <Link href={`/devices/${device.id}/edit`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <ExternalLink size={17} />
                Edit
              </Link>
              <Link href={`/devices/${device.id}#photos`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <ImagePlus size={17} />
                Add Photo
              </Link>
              <Link href={`/devices/${device.id}/maintenance/new`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Wrench size={17} />
                Maintenance
              </Link>
              <Link href={`/tasks/new?relatedDeviceId=${device.id}&category=INVENTORY&title=${encodeURIComponent(`Follow up ${device.name}`)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Plus size={17} />
                Create Task
              </Link>
              <Link href={`/alerts?assetId=${device.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <AlertTriangle size={17} />
                Alerts
              </Link>
              <Link href={`/map?asset=${device.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <MapPin size={17} />
                Map
              </Link>
            </div>
          </article>
        ))}
        {stockItems.map((item) => (
          <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">{item.name}</h2>
                <p className="font-mono text-sm text-slate-600">{item.sku || "No SKU"}</p>
                <p className="mt-1 text-sm text-slate-500">{item.storageLocation || "No stock location"} - {item.itemType.replaceAll("_", " ")}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-slate-50 p-3">
                <span className="text-slate-500">On hand</span>
                <p className="text-lg font-semibold">{item.quantityOnHand}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <span className="text-slate-500">Minimum</span>
                <p className="text-lg font-semibold">{item.minimumQuantity}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href={`/stock/${item.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                <Package size={17} />
                Open stock
              </Link>
              <Link href={`/stock/${item.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Package size={17} />
                Use / adjust
              </Link>
              <Link href={`/tasks/new?relatedStockItemId=${item.id}&category=STOCK&title=${encodeURIComponent(`Follow up ${item.name}`)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Plus size={17} />
                Create Task
              </Link>
              <Link href={`/po-tracker/new?relatedStockItemId=${item.id}&title=${encodeURIComponent(`Order ${item.name}`)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Package size={17} />
                PO Note
              </Link>
            </div>
          </article>
        ))}
      </section>

      {scannerOpen ? <CameraScanner onDetected={(value) => lookup(value)} onClose={() => setScannerOpen(false)} title="Quick inventory scan" /> : null}
    </div>
  );
}

function CameraAccessNotice() {
  const showWarning = useSyncExternalStore(
    () => () => undefined,
    () => {
      const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
      return !window.isSecureContext && !isLocalhost;
    },
    () => false,
  );

  if (!showWarning) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      Camera scanning needs HTTPS on phones. If this app is opened with plain HTTP, use the photo/manual fallback or serve the app through HTTPS.
    </div>
  );
}
