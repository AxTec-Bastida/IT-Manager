import Link from "next/link";
import { Plus, Info, ShieldAlert, MapPin, Compass, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  const zones = await prisma.locationZone.findMany({
    include: { accessPoints: true, expectedAssets: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6 mx-auto max-w-6xl">
      <PageHeader
        title="Location Zones"
        description="Logical sectors grouping physical location anchors to track static equipment."
        action={
          <Link
            href="/zones/new"
            className="inline-flex min-h-12 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus size={16} />
            Add zone
          </Link>
        }
      />

      {/* Educational Guide Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
          <Info size={18} className="text-blue-600" />
          Understanding Maps & Zones
        </h2>
        <div className="grid gap-6 md:grid-cols-3 text-sm leading-relaxed text-slate-600">
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <MapPin size={16} className="text-slate-500" />
              What is a Zone?
            </h3>
            <p>
              Zones group physical warehouse sectors (like <strong>IT Cage</strong>, <strong>Receiving</strong>, or <strong>Packing</strong>). Instead of managing hundreds of individual shelves, you group them under a single logical Zone.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Compass size={16} className="text-slate-500" />
              Zones vs. Map Anchors
            </h3>
            <p>
              Map Anchors are exact physical coordinates on the floor plan. You assign these anchors to a Zone. Static assets can then have an <strong>Expected Zone</strong> configured.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldAlert size={16} className="text-rose-600" />
              Movement Alerts
            </h3>
            <p>
              If a fixed/static asset is scanned or synced online outside of its expected zone, the system raises a <span className="font-semibold text-rose-800">FIXED_ASSET_MOVED</span> alert, which auto-resolves when it returns.
            </p>
          </div>
        </div>
      </section>

      {/* List of Zones */}
      {zones.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => (
            <Link
              key={zone.id}
              href={`/zones/${zone.id}`}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50 transition hover:border-slate-300"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-slate-950 text-base">{zone.name}</h2>
                <Badge
                  className={
                    zone.active
                      ? "bg-emerald-50 text-emerald-800 ring-emerald-200 border border-emerald-200"
                      : "bg-slate-100 text-slate-500 ring-slate-200 border border-slate-200"
                  }
                >
                  {zone.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-slate-500 line-clamp-2">{zone.description || "No description"}</p>
              <p className="mt-4 text-xs font-semibold text-slate-700 bg-slate-100 rounded px-2.5 py-1.5 inline-block">
                {zone.accessPoints.length} anchors • {zone.expectedAssets.length} expected assets
              </p>
            </Link>
          ))}
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-4 max-w-xl mx-auto">
          <div className="mx-auto rounded-full bg-slate-50 p-3 size-12 flex items-center justify-center border border-slate-200">
            <AlertCircle size={22} className="text-slate-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-950">No location zones configured</h3>
            <p className="text-sm text-slate-500 mt-2">
              Zones group physical areas like Packing, Receiving, or IT Cage. Assign map anchors to zones so the app can detect when fixed equipment moves unexpectedly.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/zones/new"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Configure First Zone
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
