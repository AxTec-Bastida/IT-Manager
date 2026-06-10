import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/badge";
import { DecommissionAssetForm } from "@/components/decommission-asset-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { PageHeader } from "@/components/page-header";
import { canPerformAction, getCurrentUser } from "@/lib/auth";
import { categoryLabels, statusLabels, statusTone } from "@/lib/constants";
import { buildDecommissionBlockers, buildDecommissionWarnings, defaultDecommissionChecklist } from "@/lib/decommission";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function DecommissionDevicePage({ params }: Props) {
  const { id } = await params;
  const [currentUser, device] = await Promise.all([
    getCurrentUser(),
    prisma.device.findUnique({
      where: { id },
      include: {
        photos: { select: { id: true, photoType: true } },
        assignmentItems: {
          where: { returnedAt: null, assignment: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } },
          include: { assignment: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        assetLoanItems: {
          where: { returnStatus: "PENDING", loan: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] } } },
          include: { loan: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        rmaItems: {
          where: { result: "PENDING", rmaCase: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } },
          include: { rmaCase: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        tasks: { where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } }, orderBy: { updatedAt: "desc" }, take: 10 },
        sourceRelationships: { where: { status: "ACTIVE" }, include: { targetDevice: true } },
        targetRelationships: { where: { status: "ACTIVE" }, include: { sourceDevice: true } },
        auditExpectedItems: { orderBy: { createdAt: "desc" }, take: 5, include: { auditSession: true } },
        auditScans: { orderBy: { scannedAt: "desc" }, take: 5, include: { auditSession: true } },
        decommissionRecords: { orderBy: { performedAt: "desc" }, take: 1 },
      },
    }),
  ]);

  if (!device) notFound();
  if (!canPerformAction(currentUser, "inventory.write")) {
    return <ForbiddenPanel message="Decommissioning assets requires IT Staff or Admin access." />;
  }

  const blockers = buildDecommissionBlockers(device);
  const warnings = buildDecommissionWarnings(device);
  const checklist = defaultDecommissionChecklist(device.category);
  const latestRecord = device.decommissionRecords[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Decommission ${device.assetTag || device.name}`}
        description="Retire, dispose, mark lost/stolen, or otherwise remove an asset from active inventory with an auditable checklist."
        action={
          <Link href={`/devices/${device.id}`} className="inline-flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <ArrowLeft size={16} />
            Back to asset
          </Link>
        }
      />

      {latestRecord ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-100 text-amber-900 ring-amber-200">Existing decommission record</Badge>
            <Badge className={statusTone[latestRecord.finalStatus]}>{statusLabels[latestRecord.finalStatus]}</Badge>
          </div>
          <p className="mt-2 text-sm text-amber-950">
            Latest record: {latestRecord.reason.replaceAll("_", " ")} on {latestRecord.performedAt.toLocaleString()} by {latestRecord.performedByName || "unknown"}.
          </p>
        </section>
      ) : null}

      <DecommissionAssetForm
        deviceId={device.id}
        assetName={device.name}
        assetTag={device.assetTag}
        categoryLabel={categoryLabels[device.category]}
        statusLabel={statusLabels[device.status]}
        blockers={blockers}
        warnings={warnings}
        checklist={checklist}
        canSubmit={Boolean(currentUser)}
      />
    </div>
  );
}
