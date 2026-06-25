import Link from "next/link";
import { AlertCircle, Compass, Info, MapPin, Plus, Settings, ShieldAlert } from "lucide-react";
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
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Location Zones"
        description="Logical warehouse sectors such as Packing, Receiving, IT Cage, Returns, Shipping, Office, or Co-Production."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/map"
              className="inline-flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <MapPin size={16} />
              Open map
            </Link>
            <Link
              href="/zones/new"
              className="inline-flex min-h-12 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Plus size={16} />
              Add zone
            </Link>
          </div>
        }
      />

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
          <Info size={18} className="text-blue-600" />
          Understanding Maps and Zones
        </h2>
        <div className="grid gap-6 text-sm leading-relaxed text-slate-600 md:grid-cols-3">
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 font-bold text-slate-900">
              <MapPin size={16} className="text-slate-500" />
              What is a zone?
            </h3>
            <p>
              Zones group physical warehouse sectors like <strong>IT Cage</strong>, <strong>Receiving</strong>, <strong>Packing</strong>, <strong>Returns</strong>, <strong>Shipping</strong>, or <strong>Co-Production</strong>.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 font-bold text-slate-900">
              <Compass size={16} className="text-slate-500" />
              Zones vs. map anchors
            </h3>
            <p>
              A map anchor is a coordinate on the warehouse floor plan. A zone is the logical area that anchor belongs to. Static assets can then have an <strong>Expected Location Zone</strong>.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 font-bold text-slate-900">
              <ShieldAlert size={16} className="text-rose-600" />
              Movement alerts
            </h3>
            <p>
              If a fixed/static asset is scanned outside its expected zone, the app raises a <span className="font-semibold text-rose-800">FIXED_ASSET_MOVED</span> alert. If it returns to the expected zone, that alert can auto-resolve.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          <Link href="/map" className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Manage map anchors
          </Link>
          <Link href="/admin/master-data" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <Settings size={15} />
            Admin / Master Data
          </Link>
        </div>
      </section>

      {zones.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => (
            <Link
              key={zone.id}
              href={`/zones/${zone.id}`}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-950">{zone.name}</h2>
                <Badge
                  className={
                    zone.active
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800 ring-emerald-200"
                      : "border border-slate-200 bg-slate-100 text-slate-500 ring-slate-200"
                  }
                >
                  {zone.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-500">{zone.description || "No description yet."}</p>
              <p className="mt-4 inline-block rounded bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                {zone.accessPoints.length} anchors / {zone.expectedAssets.length} expected assets
              </p>
            </Link>
          ))}
        </section>
      ) : (
        <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50 p-3">
            <AlertCircle size={22} className="text-slate-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-950">No location zones configured</h3>
            <p className="mt-2 text-sm text-slate-500">
              Zones group physical areas like Packing, Receiving, IT Cage, Returns, Shipping, or Co-Production. Assign map anchors to zones so the app can detect when fixed equipment moves unexpectedly.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link
              href="/zones/new"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Configure First Zone
            </Link>
            <Link
              href="/map"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Open Map
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
