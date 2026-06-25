import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { EmailActionButton } from "@/components/email-action-button";
import { assignmentStatusLabels, categoryLabels, conditionLabels, statusLabels, statusTone } from "@/lib/constants";
import { assignmentResponsibleLabel } from "@/lib/assignment-views";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emailWarning?: string }>;
};

export default async function AssignmentDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { emailWarning } = await searchParams;
  const showEmailSkippedWarning = emailWarning === "skipped";

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: { employee: true, items: { include: { asset: true } } },
  });
  if (!assignment) notFound();
  const hasReturnedItems = assignment.items.some((item) => item.returnedAt || item.returnStatus !== "NOT_RETURNED");
  const responsibleLabel = assignmentResponsibleLabel(assignment);
  const defaultRecipient = assignment.employee?.email ?? undefined;

  return (
    <div className="space-y-6">
      {showEmailSkippedWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-3 shadow-sm">
          <div className="shrink-0 text-amber-700 font-semibold text-lg">⚠️</div>
          <div>
            <p className="font-semibold text-amber-950">Assignment created</p>
            <p className="mt-0.5 text-amber-800">Email skipped because SMTP is not configured.</p>
          </div>
        </div>
      )}

      <PageHeader
        title={assignment.assignmentNumber}
        description={`Responsible: ${responsibleLabel} on ${assignment.assignmentDate.toLocaleString()}`}
        action={
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-500" disabled>
            <Printer size={16} />
            Print coming soon
          </button>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-100 text-indigo-800 ring-indigo-200">{assignmentStatusLabels[assignment.status]}</Badge>
            {assignment.termsAccepted ? <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">Terms accepted</Badge> : null}
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-xs font-medium uppercase text-slate-500">Responsibility target</dt>
              <dd className="mt-1 text-sm text-slate-950">
                {assignment.employee ? (
                  <Link href={`/employees/${assignment.employee.id}`} className="font-semibold hover:underline">{assignment.employee.fullName}</Link>
                ) : (
                  <span className="font-semibold">{responsibleLabel}</span>
                )}
                {assignment.targetType !== "EMPLOYEE" ? <span className="ml-2 text-xs text-slate-500">{assignment.targetType.replaceAll("_", " ")}</span> : null}
              </dd>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-xs font-medium uppercase text-slate-500">Assigned by</dt>
              <dd className="mt-1 text-sm text-slate-950">{assignment.assignedBy || "-"}</dd>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-xs font-medium uppercase text-slate-500">Email status</dt>
              <dd className="mt-1 text-sm text-slate-950">{assignment.emailSentAt ? `Receipt sent ${assignment.emailSentAt.toLocaleString()}` : assignment.emailError || "No receipt sent yet"}</dd>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-xs font-medium uppercase text-slate-500">Created</dt>
              <dd className="mt-1 text-sm text-slate-950">{assignment.createdAt.toLocaleString()}</dd>
            </div>
          </dl>
          {assignment.termsText ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{assignment.termsText}</p> : null}
          {assignment.notes ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{assignment.notes}</p> : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Signature</h2>
          {assignment.signatureData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assignment.signatureData} alt="Assignment signature" className="mt-3 rounded-md border border-slate-200 bg-white" />
          ) : (
            <p className="mt-3 text-sm text-slate-500">No signature captured.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Email receipts</h2>
        <p className="mt-1 text-sm text-slate-500">Sending email is manual and logged. The assignment stays saved even if email is skipped or fails.</p>
        {!defaultRecipient ? <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">This responsibility target has no employee email. Enter a recipient manually if you need to send a receipt.</p> : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <EmailActionButton endpoint={`/api/assignments/${assignment.id}/email`} kind="receipt" label="Send assignment receipt" defaultRecipient={defaultRecipient} />
          {hasReturnedItems ? <EmailActionButton endpoint={`/api/assignments/${assignment.id}/email`} kind="return" label="Send return confirmation" defaultRecipient={defaultRecipient} /> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Assigned assets</h2>
        <div className="mt-3 grid gap-3">
          {assignment.items.map((item) => (
            <article key={item.id} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{item.asset.name}</p>
                  <p className="text-slate-600">{item.asset.assetTag || item.asset.serialNumber || item.asset.ipAddress || "No tag"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Return status: {item.returnStatus.replaceAll("_", " ")}
                    {item.returnedAt ? ` - returned ${item.returnedAt.toLocaleString()}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{categoryLabels[item.asset.category]} • Assigned condition: {item.assignedCondition ? conditionLabels[item.assignedCondition] : "-"}</p>
                </div>
                <Badge className={statusTone[item.asset.status]}>{statusLabels[item.asset.status]}</Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Link href={`/devices/${item.asset.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-3 font-semibold text-white hover:bg-slate-800">
                  Open asset
                </Link>
                {!item.returnedAt ? (
                  <Link href={`/devices/${item.asset.id}/return`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-3 font-semibold text-emerald-800 hover:bg-emerald-50">
                    <RotateCcw size={16} />
                    Return item
                  </Link>
                ) : null}
              </div>
              {item.returnNotes ? <p className="mt-3 rounded-md bg-white p-3 text-slate-600">{item.returnNotes}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
