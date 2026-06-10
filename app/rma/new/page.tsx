import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { RmaForm } from "@/components/rma-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function NewRmaPage({ searchParams }: { searchParams?: Promise<{ deviceId?: string }> }) {
  if (!(await hasPagePermission("rma.write"))) return <ForbiddenPanel message="Creating RMA repair batches requires IT Staff or Admin access." />;
  const query = searchParams ? await searchParams : {};
  const devices = await prisma.device.findMany({
    where: { status: { notIn: ["RETIRED", "DISPOSED", "LOST"] } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, assetTag: true, serialNumber: true, model: true, category: true, status: true, assignedTo: true, employeeId: true, employee: { select: { fullName: true } } },
  });
  const sortedDevices = query.deviceId ? devices.sort((a, b) => (a.id === query.deviceId ? -1 : b.id === query.deviceId ? 1 : 0)) : devices;

  return (
    <div className="space-y-6">
      <PageHeader title="New RMA" description="Create a repair batch, select devices, and send them without deleting assignment history." />
      <RmaForm devices={sortedDevices} initialDeviceIds={query.deviceId ? [query.deviceId] : []} />
    </div>
  );
}
