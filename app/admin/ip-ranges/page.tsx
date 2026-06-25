import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPageRole } from "@/lib/page-permissions";
import { IpRangeManager } from "@/components/ip-range-manager";

export const dynamic = "force-dynamic";

export default async function AdminIpRangesPage() {
  if (!(await hasPageRole("ADMIN"))) {
    return <ForbiddenPanel message="IP range management is admin-only." />;
  }

  const ranges = await prisma.ipRange.findMany({
    include: {
      _count: {
        select: { devices: true },
      },
    },
    orderBy: [{ active: "desc" }, { vlan: "asc" }, { name: "asc" }],
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Network / IP Ranges"
        description="Manage VLAN subnets, categories, and DHCP/static IP allocation pools."
      />
      <IpRangeManager initialRanges={ranges} />
    </div>
  );
}
