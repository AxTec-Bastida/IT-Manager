import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { ReturnAssetForm } from "@/components/return-asset-form";
import { assignmentStatusLabels, categoryLabels, conditionLabels, statusLabels, statusTone } from "@/lib/constants";
import { assignmentResponsibleLabel } from "@/lib/assignment-views";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ReturnAssetPage({ params }: Props) {
  const { id } = await params;
  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      employee: true,
      assignmentItems: {
        where: { returnedAt: null, assignment: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } },
        include: { assignment: { include: { employee: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!device) notFound();

  const activeItem = device.assignmentItems[0];
  const employee = activeItem?.assignment.employee ?? device.employee;
  const responsibilityLabel = activeItem ? assignmentResponsibleLabel(activeItem.assignment) : employee?.fullName || device.assignedTo || null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Return / Unassign"
        description="Return an assigned asset without deleting assignment history."
        action={
          <Link href={`/devices/${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <ArrowLeft size={16} />
            Back to asset
          </Link>
        }
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={statusTone[device.status]}>{statusLabels[device.status]}</Badge>
          <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{categoryLabels[device.category]}</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase text-slate-500">Asset</p>
            <p className="mt-1 font-semibold text-slate-950">{device.name}</p>
            <p className="text-sm text-slate-600">{device.assetTag || device.serialNumber || device.ipAddress || "No tag"}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase text-slate-500">Responsibility target</p>
            <p className="mt-1 font-semibold text-slate-950">{responsibilityLabel || "Not currently assigned"}</p>
            {employee?.employeeId || employee?.department ? <p className="text-sm text-slate-600">{[employee.employeeId, employee.department].filter(Boolean).join(" - ")}</p> : null}
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase text-slate-500">Current condition</p>
            <p className="mt-1 font-semibold text-slate-950">{conditionLabels[device.condition]}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase text-slate-500">Assignment</p>
            {activeItem ? (
              <>
                <Link href={`/assignments/${activeItem.assignmentId}`} className="mt-1 block font-semibold text-slate-950 hover:underline">{activeItem.assignment.assignmentNumber}</Link>
                <p className="text-sm text-slate-600">{assignmentStatusLabels[activeItem.assignment.status]}</p>
              </>
            ) : (
              <p className="mt-1 font-semibold text-slate-950">No active assignment item found</p>
            )}
          </div>
        </div>
      </section>

      {device.employeeId || device.assignedTo || activeItem || device.status === "IN_USE_ASSIGNED" ? (
        <ReturnAssetForm assetId={device.id} assetName={device.name} employeeName={responsibilityLabel} />
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          This asset is not currently assigned.
        </section>
      )}
    </div>
  );
}
