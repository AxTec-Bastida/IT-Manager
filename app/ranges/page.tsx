import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { SuggestIpButton } from "@/components/suggest-ip-button";
import { categoryLabels } from "@/lib/constants";
import { rangeSize, validateIpRange } from "@/lib/ip";

export const dynamic = "force-dynamic";

export default async function RangesPage() {
  const ranges = await prisma.ipRange.findMany({
    include: { devices: true },
    orderBy: [{ active: "desc" }, { vlan: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="IP ranges / pools"
        description="Reserved IP pools by category, VLAN, and warehouse area."
        action={
          <Link href="/ranges/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <Plus size={16} />
            Add range
          </Link>
        }
      />

      <div className="grid gap-4">
        {ranges.map((range) => {
          const valid = validateIpRange(range.startIp, range.endIp).ok;
          const capacity = valid ? rangeSize(range.startIp, range.endIp) : 0;
          const used = range.devices.filter((device) => ["ACTIVE", "RESERVED"].includes(device.status)).length;
          return (
            <section key={range.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-950">{range.name}</h2>
                    <Badge className={range.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-zinc-200 text-zinc-700 ring-zinc-300"}>
                      {range.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {categoryLabels[range.category]} • VLAN {range.vlan} • {range.location || "No location"}
                  </p>
                  <p className="mt-2 font-mono text-sm text-slate-950">
                    {range.startIp} - {range.endIp} {range.subnet ? `(${range.subnet})` : ""}
                  </p>
                  {range.notes ? <p className="mt-2 text-sm text-slate-600">{range.notes}</p> : null}
                </div>
                <div className="min-w-56 rounded-md bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-950">{used}/{capacity} used</p>
                  <p className="text-slate-600">{Math.max(capacity - used, 0)} available</p>
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <SuggestIpButton rangeId={range.id} />
              </div>
            </section>
          );
        })}
        {ranges.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No ranges yet. Add your first reserved pool.</div> : null}
      </div>
    </div>
  );
}
