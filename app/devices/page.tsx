import Link from "next/link";
import { MoreHorizontal, Plus, ScanLine, Search, SlidersHorizontal } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { categoryLabels, categoryOptions, conditionLabels, conditionOptions, conditionTone, statusLabels, statusOptions, statusTone } from "@/lib/constants";
import { detectInventoryConflicts } from "@/lib/conflicts";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function DevicesPage({ searchParams }: Props) {
  const params = await searchParams;
  const [allDevices, ranges] = await Promise.all([
    prisma.device.findMany({ include: { ipRange: true, employee: true, locationHistory: { orderBy: { seenAt: "desc" }, take: 1 } }, orderBy: [{ status: "asc" }, { name: "asc" }] }),
    prisma.ipRange.findMany({ orderBy: { name: "asc" } }),
  ]);

  const conflicts = detectInventoryConflicts(allDevices);
  const conflictedIds = new Set(conflicts.flatMap((conflict) => conflict.affectedDeviceIds ?? []));
  const query = params.q?.toLowerCase() ?? "";
  const devices = allDevices.filter((device) => {
    const matchesSearch =
      !query ||
      [device.assetTag, device.name, device.ipAddress, device.macAddress, device.serialNumber, device.location, device.brand, device.model, device.assignedTo, device.employee?.fullName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    const matchesCategory = !params.category || device.category === params.category;
    const matchesStatus = !params.status || device.status === params.status;
    const matchesVlan = !params.vlan || device.vlan === Number(params.vlan);
    const matchesCondition = !params.condition || device.condition === params.condition;
    const matchesMissing = params.missing !== "true" || device.status === "MISSING";
    const matchesEmployee = !params.employee || [device.assignedTo, device.employee?.fullName].filter(Boolean).some((value) => value!.toLowerCase().includes(params.employee!.toLowerCase()));
    const matchesConflict = !params.conflict || (params.conflict === "yes" ? conflictedIds.has(device.id) : !conflictedIds.has(device.id));
    return matchesSearch && matchesCategory && matchesStatus && matchesVlan && matchesCondition && matchesMissing && matchesEmployee && matchesConflict;
  });

  const vlans = [...new Set(allDevices.map((device) => device.vlan).filter((vlan): vlan is number => vlan != null))].sort((a, b) => a - b);
  const activeFilters = [
    params.category ? categoryLabels[params.category as keyof typeof categoryLabels] : null,
    params.status ? statusLabels[params.status as keyof typeof statusLabels] : null,
    params.condition ? conditionLabels[params.condition as keyof typeof conditionLabels] : null,
    params.vlan ? `VLAN ${params.vlan}` : null,
    params.employee ? `User: ${params.employee}` : null,
    params.conflict ? (params.conflict === "yes" ? "Has conflict" : "No conflict") : null,
    params.missing === "true" ? "Missing only" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Search, filter, assign, and manage warehouse IT assets while preserving IPAM details where applicable."
        action={
          <div className="grid gap-2 sm:flex">
            <Link href="/scan" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ScanLine size={16} />
              Scan label
            </Link>
            <Link href="/devices/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <Plus size={16} />
            Add asset
            </Link>
          </div>
        }
      />

      <form className="sticky top-[73px] z-20 space-y-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur lg:static lg:p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-4 text-slate-400" size={16} />
            <input name="q" defaultValue={params.q ?? ""} placeholder="Search asset, tag, serial, MAC, IP, employee" className="min-h-14 w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-base sm:min-h-12 sm:text-sm" />
          </label>
          <button className="min-h-14 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white sm:min-h-12 sm:text-sm">Search</button>
        </div>

        {activeFilters.length ? (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <span key={filter} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{filter}</span>
            ))}
            <Link href="/devices" className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">Clear</Link>
          </div>
        ) : null}

        <details className="rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex min-h-12 items-center justify-between px-3 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} />Filters</span>
            <span className="text-xs text-slate-500">{activeFilters.length ? `${activeFilters.length} active` : "Optional"}</span>
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-3 xl:grid-cols-6">
            <select name="category" defaultValue={params.category ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">All categories</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
            </select>
            <select name="status" defaultValue={params.status ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">All statuses</option>
              {statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
            <select name="condition" defaultValue={params.condition ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">All conditions</option>
              {conditionOptions.map((condition) => <option key={condition} value={condition}>{conditionLabels[condition]}</option>)}
            </select>
            <select name="vlan" defaultValue={params.vlan ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">All VLANs</option>
              {vlans.map((vlan) => <option key={vlan} value={vlan}>VLAN {vlan}</option>)}
            </select>
            <select name="conflict" defaultValue={params.conflict ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">Conflict status</option>
              <option value="yes">Has conflict</option>
              <option value="no">No conflict</option>
            </select>
            <input name="employee" defaultValue={params.employee ?? ""} placeholder="Assigned user" className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="missing" value="true" type="checkbox" defaultChecked={params.missing === "true"} />
              Missing only
            </label>
            <button className="min-h-12 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white md:col-span-2 xl:col-span-6 sm:text-sm">Apply filters</button>
          </div>
        </details>
      </form>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Tag</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Serial</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">VLAN</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3">Conflict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {devices.map((device) => (
              <tr key={device.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/devices/${device.id}`} className="font-semibold text-slate-950 hover:underline">
                    {device.name}
                  </Link>
                  <p className="text-xs text-slate-500">{device.brand} {device.model}</p>
                </td>
                <td className="px-4 py-3 font-mono">{device.assetTag || "-"}</td>
                <td className="px-4 py-3 font-mono">{device.ipAddress || "-"}</td>
                <td className="px-4 py-3">{device.serialNumber || "-"}</td>
                <td className="px-4 py-3">{categoryLabels[device.category]}</td>
                <td className="px-4 py-3">{device.vlan ?? "-"}</td>
                <td className="px-4 py-3">{device.location || "-"}</td>
                <td className="px-4 py-3">{device.employee?.fullName || device.assignedTo || "-"}</td>
                <td className="px-4 py-3"><Badge className={statusTone[device.status]}>{statusLabels[device.status]}</Badge></td>
                <td className="px-4 py-3"><Badge className={conditionTone[device.condition]}>{conditionLabels[device.condition]}</Badge></td>
                <td className="px-4 py-3">{conflictedIds.has(device.id) ? <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Flagged</Badge> : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {devices.map((device) => (
          <article key={device.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-950">{device.name}</h2>
                <p className="font-mono text-sm text-slate-600">{device.assetTag || device.ipAddress || device.serialNumber || "No tag"}</p>
              </div>
              <Badge className={statusTone[device.status]}>{statusLabels[device.status]}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <span>{categoryLabels[device.category]}</span>
              {device.ipAddress ? <span>{device.ipAddress}</span> : null}
              {device.serialNumber ? <span>Serial {device.serialNumber}</span> : null}
              {device.vlan ? <span>VLAN {device.vlan}</span> : null}
              <span>{device.location || "No location"}</span>
              <span>{device.employee?.fullName || device.assignedTo || "Unassigned"}</span>
              <Badge className={conditionTone[device.condition]}>{conditionLabels[device.condition]}</Badge>
              {conflictedIds.has(device.id) ? <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Alert</Badge> : null}
              {device.locationHistory[0] ? <span>Last map: {device.locationHistory[0].locationLabel}</span> : null}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Link href={`/devices/${device.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">Open</Link>
              <Link href={`/devices/${device.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-1 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Edit</Link>
              <Link href={`/map?asset=${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-1 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700"><MoreHorizontal size={15} />More</Link>
            </div>
          </article>
        ))}
      </div>

      {devices.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No devices match the current filters.</div> : null}
      <p className="text-xs text-slate-500">Configured ranges available for new devices: {ranges.length}</p>
    </div>
  );
}
