import { ClipboardCheck } from "lucide-react";
import { categoryOptions } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { ActionLink, PageActions } from "@/components/ui-patterns";
import { AuditStartForm } from "@/components/audit-start-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewAuditPage() {
  if (!(await hasPagePermission("audits.write"))) return <ForbiddenPanel message="Starting physical audits requires Auditor, IT Staff, or Admin access." />;
  const anchors = await prisma.accessPointMapLocation.findMany({
    where: { active: true },
    orderBy: [{ displayPath: "asc" }, { locationLabel: "asc" }],
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Start Physical Audit"
        description="Choose an area, location, or category. The app snapshots expected assets before scanning starts."
        action={
          <PageActions>
            <ActionLink href="/audits">
              <ClipboardCheck size={16} />
              Audits
            </ActionLink>
          </PageActions>
        }
      />
      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        Audit scans are observations. Starting an audit does not change asset locations, statuses, assignments, loans, RMA, aliases, photos, or facturas.
      </section>
      <AuditStartForm
        categories={categoryOptions}
        anchors={anchors.map((anchor) => ({
          id: anchor.id,
          locationLabel: anchor.locationLabel,
          area: anchor.area,
          department: anchor.department,
          station: anchor.station,
          displayPath: anchor.displayPath,
        }))}
      />
    </div>
  );
}
