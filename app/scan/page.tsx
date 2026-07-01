import Link from "next/link";
import { ScanLine } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { QuickScanPanel } from "@/components/quick-scan-panel";
import { prisma } from "@/lib/prisma";
import { canPerformAction, getCurrentUser } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n";
import { getLocaleFromCookies } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const locale = await getLocaleFromCookies();
  const text = createTranslator(locale, "scan");
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
        title={text("title")}
        description={text("description")}
      />
      {activeAudit && permissions.audits ? (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950">
          <p className="text-sm font-semibold">{text("activeAudit", { title: activeAudit.title })}</p>
          <Link href={`/audits/${activeAudit.id}/scan`} className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
            <ScanLine size={16} />
            {text("scanIntoActiveAudit")}
          </Link>
        </section>
      ) : null}
      <QuickScanPanel permissions={permissions} />
    </div>
  );
}
