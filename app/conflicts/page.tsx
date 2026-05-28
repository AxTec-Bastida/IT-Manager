import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { DetectConflictsButton } from "@/components/detect-conflicts-button";
import { severityTone } from "@/lib/constants";
import { detectInventoryConflicts } from "@/lib/conflicts";

export const dynamic = "force-dynamic";

export default async function ConflictsPage() {
  const devices = await prisma.device.findMany({ include: { ipRange: true } });
  const liveConflicts = detectInventoryConflicts(devices);
  const devicesById = new Map(devices.map((device) => [device.id, device]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conflicts"
        description="Duplicate IPs, duplicate MACs, range mismatches, VLAN mismatches, and duplicate names."
        action={<DetectConflictsButton />}
      />

      <div className="grid gap-4">
        {liveConflicts.map((conflict) => (
          <section key={`${conflict.type}-${conflict.title}`} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-950">{conflict.title}</h2>
                  <Badge className={severityTone[conflict.severity]}>{conflict.severity}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{conflict.description}</p>
                <p className="mt-2 text-sm font-medium text-slate-950">Suggested fix: {conflict.suggestedFix}</p>
              </div>
              <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{conflict.type.replaceAll("_", " ")}</Badge>
            </div>
            {conflict.affectedDeviceIds?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {conflict.affectedDeviceIds.map((id) => {
                  const device = devicesById.get(id);
                  return device ? (
                    <Link key={id} href={`/devices/${id}`} className="rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                      {device.name} ({device.ipAddress})
                    </Link>
                  ) : null;
                })}
              </div>
            ) : null}
          </section>
        ))}
        {liveConflicts.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No active conflicts detected.</div> : null}
      </div>
    </div>
  );
}
