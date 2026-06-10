import Link from "next/link";
import { Camera, ClipboardList, HardDrive, ImagePlus, Printer, Search } from "lucide-react";
import { Badge } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { PageHeader } from "@/components/page-header";
import { EmptyState, MobileCard, SectionCard } from "@/components/ui-patterns";
import { categoryLabels, statusLabels } from "@/lib/constants";
import { hasPagePermission } from "@/lib/page-permissions";
import { buildPhotoChecklist, requiredPhotoLabels, type RequiredPhotoType } from "@/lib/photo-compliance";
import { buildThumbnailBackfillPlan, getPhotoStorageSummary } from "@/lib/photo-storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const photoTypeFilters: RequiredPhotoType[] = ["OVERVIEW", "ASSET_TAG", "SERIAL_LABEL", "CONDITION", "LOCATION_INSTALLED", "DAMAGE", "RMA_CONDITION", "RETURN_CONDITION"];

export default async function PhotoCompliancePage({ searchParams }: Props) {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Photo compliance requires IT Staff or Admin access." />;
  const query = await searchParams;
  const filters = {
    q: textParam(query?.q),
    category: textParam(query?.category),
    status: textParam(query?.status),
    missing: textParam(query?.missing) as RequiredPhotoType | "",
    location: textParam(query?.location),
  };

  const [devices, storage, thumbnailBackfill] = await Promise.all([
    prisma.device.findMany({
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        assetTag: true,
        serialNumber: true,
        category: true,
        status: true,
        condition: true,
        location: true,
        areaDepartment: true,
        isFixedAsset: true,
        usesStaticIp: true,
        assignedTo: true,
        employee: { select: { fullName: true } },
        photos: { select: { photoType: true, isPrimary: true } },
        rmaItems: { select: { returnedAt: true, result: true } },
        assignmentItems: { select: { returnedAt: true } },
        assetLoanItems: { select: { returnedAt: true } },
      },
    }),
    getPhotoStorageSummary(prisma),
    buildThumbnailBackfillPlan(prisma),
  ]);

  const queue = devices
    .map((device) => ({ ...device, checklist: buildPhotoChecklist(device) }))
    .filter((device) => device.checklist.missing.length > 0)
    .filter((device) => matchesFilters(device, filters));
  const visible = queue.slice(0, 75);
  const noPhotos = queue.filter((device) => device.checklist.hasNoPhotos).length;
  const fixedMissingLocation = queue.filter((device) => device.checklist.missing.includes("LOCATION_INSTALLED")).length;
  const activeFilterCount = [filters.q, filters.category, filters.status, filters.missing, filters.location].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Photo Compliance"
        description="Phone-first queue for assets missing recommended audit photos. Review-only: this does not block workflows."
        action={
          <Link href="/devices" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <Search size={16} />
            Inventory
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Assets needing photos" value={queue.length} helper="Current filtered queue" icon={Camera} />
        <SummaryCard label="No photos" value={noPhotos} helper="Need first photo set" icon={ImagePlus} />
        <SummaryCard label="Fixed missing location" value={fixedMissingLocation} helper="Installed assets" icon={Camera} />
        <SummaryCard label="Total photo files" value={storage.totalPhotoCount} helper={`${formatBytes(storage.assetPhotoStorageBytes + storage.stockPhotoStorageBytes)} stored`} icon={HardDrive} />
        <SummaryCard label="Backfill candidates" value={thumbnailBackfill.candidates.length} helper="Run dry-run before apply" icon={Printer} />
      </section>

      <SectionCard>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <div>
            <h2 className="font-semibold text-slate-950">Thumbnail Backfill Tools</h2>
            <p className="mt-1 text-sm text-slate-600">
              Use these maintenance commands after uploads or restore work. Dry-run is read-only. Apply requires a fresh backup and explicit confirmation.
            </p>
            <div className="mt-3 grid gap-2 text-sm">
              <code className="block overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-white">npm run photos:backfill-thumbnails:dry-run</code>
              <code className="block overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-white">npm run photos:backfill-thumbnails:apply -- --confirm --limit 100</code>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <SignalPill label="Candidates" value={thumbnailBackfill.candidates.length} />
            <SignalPill label="Ready" value={thumbnailBackfill.alreadyReady.length} />
            <SignalPill label="Missing originals" value={thumbnailBackfill.missingOriginals.length} tone={thumbnailBackfill.missingOriginals.length ? "border-rose-200 bg-rose-50 text-rose-900" : undefined} />
            <SignalPill label="Unsupported" value={thumbnailBackfill.unsupportedPhotos.length} />
            <SignalPill label="Oversized" value={thumbnailBackfill.oversizedPhotos.length} />
            <SignalPill label="Stock photos" value={thumbnailBackfill.stockPhotoCount} />
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form className="grid flex-1 gap-3 md:grid-cols-5">
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              Search queue
              <input name="q" defaultValue={filters.q} placeholder="Asset tag, name, serial, location" className={inputClass} />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Category
              <select name="category" defaultValue={filters.category} className={inputClass}>
                <option value="">All</option>
                {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Missing type
              <select name="missing" defaultValue={filters.missing} className={inputClass}>
                <option value="">Any</option>
                {photoTypeFilters.map((type) => <option key={type} value={type}>{requiredPhotoLabels[type]}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Status
              <select name="status" defaultValue={filters.status} className={inputClass}>
                <option value="">All</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <div className="md:col-span-5 grid gap-2 sm:flex">
              <button className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800">Apply filters</button>
              {activeFilterCount ? <Link href="/photos/compliance" className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-100">Clear filters</Link> : null}
            </div>
          </form>
          <Badge className="w-fit bg-slate-100 text-slate-700 ring-slate-200">{activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}</Badge>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Missing Photo Queue</h2>
            <p className="text-sm text-slate-500">Showing {visible.length} of {queue.length}. Use filters to focus a capture session.</p>
          </div>
          <Link href="/inventory/missing-photos" className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Inventory missing photos</Link>
        </div>
        {visible.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visible.map((asset) => (
              <MobileCard key={asset.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">{categoryLabels[asset.category]}</p>
                    <h3 className="text-lg font-semibold text-slate-950">{asset.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{asset.assetTag || "No asset tag"} / {asset.serialNumber || "No serial"}</p>
                    <p className="text-sm text-slate-500">{asset.employee?.fullName || asset.assignedTo || asset.location || asset.areaDepartment || "No responsibility/location"}</p>
                  </div>
                  <Badge className="w-fit bg-amber-50 text-amber-800 ring-amber-200">{asset.checklist.missing.length} missing</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {asset.checklist.missing.map((type) => (
                    <span key={type} className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">{requiredPhotoLabels[type]}</span>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Link href={`/devices/${asset.id}?photoType=${asset.checklist.missing[0]}#photos`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 font-semibold text-white hover:bg-slate-800">
                    <ImagePlus size={16} />
                    Add Photo
                  </Link>
                  <Link href={`/devices/${asset.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100">Open Asset</Link>
                  <Link href={`/tasks/new?title=${encodeURIComponent(`Add photos: ${asset.assetTag || asset.name}`)}&category=PHOTO_COMPLIANCE&relatedDeviceId=${asset.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100">
                    <ClipboardList size={16} />
                    Create Task
                  </Link>
                  {asset.assetTag ? <Link href={`/labels?mode=manual&manual=${encodeURIComponent(asset.assetTag)}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100">Generate Label</Link> : null}
                </div>
              </MobileCard>
            ))}
          </div>
        ) : (
          <EmptyState title="No assets match this photo filter" description="Clear filters or check Data Quality for other photo compliance signals." />
        )}
      </SectionCard>
    </div>
  );
}

const inputClass = "w-full min-h-12 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:text-sm";

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function matchesFilters(device: { name: string; assetTag: string | null; serialNumber: string | null; category: string; status: string; location: string | null; areaDepartment: string | null; checklist: { missing: string[] } }, filters: { q: string; category: string; status: string; missing: string; location: string }) {
  if (filters.category && device.category !== filters.category) return false;
  if (filters.status && device.status !== filters.status) return false;
  if (filters.missing && !device.checklist.missing.includes(filters.missing)) return false;
  const haystack = `${device.name} ${device.assetTag ?? ""} ${device.serialNumber ?? ""} ${device.location ?? ""} ${device.areaDepartment ?? ""}`.toLowerCase();
  if (filters.q && !haystack.includes(filters.q.toLowerCase())) return false;
  if (filters.location && !`${device.location ?? ""} ${device.areaDepartment ?? ""}`.toLowerCase().includes(filters.location.toLowerCase())) return false;
  return true;
}

function SummaryCard({ label, value, helper, icon: Icon }: { label: string; value: string | number; helper: string; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <Icon className="shrink-0 text-slate-400" size={20} />
      </div>
    </div>
  );
}

function SignalPill({ label, value, tone = "border-slate-200 bg-slate-50 text-slate-700" }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${tone}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}
