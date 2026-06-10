import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Edit, Plus, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { EmailActionButton } from "@/components/email-action-button";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { ActionLink, PageActions } from "@/components/ui-patterns";
import { daysActive } from "@/lib/rma";
import { categoryLabels, rmaCaseStatusLabels, rmaCaseStatusTone, rmaItemResultLabels, rmaItemResultTone, statusLabels } from "@/lib/constants";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function RmaDetailPage({ params }: Props) {
  if (!(await hasPagePermission("rma.write"))) return <ForbiddenPanel message="RMA repair records require IT Staff or Admin access." />;
  const { id } = await params;
  const [rma, activity] = await Promise.all([
    prisma.rmaCase.findUnique({
      where: { id },
      include: { items: { include: { device: true, replacementDevice: true }, orderBy: [{ result: "asc" }, { createdAt: "asc" }] } },
    }),
    prisma.activityLog.findMany({ where: { OR: [{ entityId: id }, { metadata: { contains: id } }] }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  if (!rma) notFound();
  const pending = rma.items.filter((item) => item.result === "PENDING").length;
  const returned = rma.items.length - pending;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`RMA ${rma.rmaNumber}`}
        description={rma.title || `${rma.destination}${rma.vendorName ? ` / ${rma.vendorName}` : ""}`}
        action={
          <PageActions>
            <ActionLink href={`/rma/${rma.id}/edit`}><Edit size={16} />Edit RMA</ActionLink>
            <ActionLink href={`/rma/${rma.id}/receive`} variant="primary"><RotateCcw size={16} />Receive devices</ActionLink>
          </PageActions>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Summary label="Status" value={rmaCaseStatusLabels[rma.status]} badge={rmaCaseStatusTone[rma.status]} />
        <Summary label="Devices" value={rma.items.length} />
        <Summary label="Pending" value={pending} />
        <Summary label="Returned" value={returned} />
        <Summary label="Days active" value={daysActive(rma.sentAt)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 xl:col-span-2">
          <h2 className="font-semibold text-slate-950">RMA details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="Destination" value={rma.destination} />
            <Info label="Vendor" value={rma.vendorName || "-"} />
            <Info label="Carrier / tracking" value={[rma.carrier, rma.trackingNumber].filter(Boolean).join(" / ") || "-"} />
            <Info label="Sent date" value={dateText(rma.sentAt) || "Not sent"} />
            <Info label="Expected follow-up" value={dateText(rma.expectedFollowUpAt) || "No follow-up date"} />
            <Info label="Reminder after" value={`${rma.reminderAfterDays} days`} />
            <Info label="Contact" value={[rma.contactName, rma.contactEmail].filter(Boolean).join(" / ") || "-"} />
          </div>
          {rma.notes ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{rma.notes}</p> : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Quick actions</h2>
          <div className="mt-3 grid gap-2">
            <ActionLink href={`/rma/${rma.id}/edit`}><Plus size={16} />Add devices</ActionLink>
            <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Follow up RMA ${rma.rmaNumber}`)}&category=RMA&notes=${encodeURIComponent(`/rma/${rma.id}`)}`}><ClipboardList size={16} />Create Task</ActionLink>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Devices</h2>
        <div className="mt-4 grid gap-3">
          {rma.items.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/devices/${item.deviceId}`} className="font-semibold text-slate-950 hover:underline">{item.device.name}</Link>
                    <Badge className={rmaItemResultTone[item.result]}>{rmaItemResultLabels[item.result]}</Badge>
                    <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{categoryLabels[item.device.category]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.device.assetTag || "No tag"} / {item.device.serialNumber || "No serial"} / {item.device.model || "No model"}</p>
                  <p className="text-sm text-slate-500">{statusLabels[item.device.status]}{item.returnedAt ? ` / returned ${item.returnedAt.toLocaleDateString()}` : ""}</p>
                  {item.issueDescription ? <p className="mt-2 text-sm text-slate-600">{item.issueDescription}</p> : null}
                </div>
                <ActionLink href={`/devices/${item.deviceId}`}>Open asset</ActionLink>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Email summaries</h2>
        <p className="mt-1 text-sm text-slate-500">Send RMA emails manually to the configured contact or an override recipient. Email failures are logged only.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <EmailActionButton endpoint={`/api/rma/${rma.id}/email`} kind="sent" label="Send RMA sent summary" defaultRecipient={rma.contactEmail} />
          <EmailActionButton endpoint={`/api/rma/${rma.id}/email`} kind="follow_up" label="Send follow-up reminder" defaultRecipient={rma.contactEmail} />
          {["RETURNED", "CLOSED"].includes(rma.status) ? <EmailActionButton endpoint={`/api/rma/${rma.id}/email`} kind="closed" label="Send closed summary" defaultRecipient={rma.contactEmail} /> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Activity</h2>
        <div className="mt-3 space-y-2">
          {activity.map((entry) => (
            <div key={entry.id} className="rounded-md bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-950">{entry.message}</p>
              <p className="text-xs text-slate-500">{entry.createdAt.toLocaleString()}</p>
            </div>
          ))}
          {activity.length === 0 ? <p className="text-sm text-slate-500">No RMA activity yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value, badge }: { label: string; value: React.ReactNode; badge?: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-3 text-2xl font-semibold text-slate-950">{badge ? <Badge className={badge}>{value}</Badge> : value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-medium text-slate-950">{value}</p></div>;
}

function dateText(value?: Date | null) {
  return value ? value.toLocaleDateString() : "";
}
