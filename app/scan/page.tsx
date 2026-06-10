import Link from "next/link";
import { ScanLine } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { QuickScanPanel } from "@/components/quick-scan-panel";
import { prisma } from "@/lib/prisma";
import { canPerformAction, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const [activeAudit, currentUser] = await Promise.all([
    prisma.inventoryAuditSession.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
      select: { id: true, title: true, auditNumber: true },
    }),
    getCurrentUser(),
  ]);
  const permissions = {
    inventory: canPerformAction(currentUser, "inventory.write"),
    assignments: canPerformAction(currentUser, "assignments.write"),
    loans: canPerformAction(currentUser, "loans.write"),
    stock: canPerformAction(currentUser, "stock.write"),
    rma: canPerformAction(currentUser, "rma.write"),
    tasks: canPerformAction(currentUser, "tasks.write"),
    audits: canPerformAction(currentUser, "audits.write"),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Camera scan"
        description="Scan QR codes, barcodes, serial labels, MAC labels, IP labels, or internal tags to find and update devices quickly."
      />
      {activeAudit && permissions.audits ? (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950">
          <p className="text-sm font-semibold">Active audit: {activeAudit.title}</p>
          <Link href={`/audits/${activeAudit.id}/scan`} className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
            <ScanLine size={16} />
            Scan into active audit
          </Link>
        </section>
      ) : null}
      <QuickScanPanel permissions={permissions} />
    </div>
  );
}
