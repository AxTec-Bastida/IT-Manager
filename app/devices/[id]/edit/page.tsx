import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DeviceForm } from "@/components/device-form";
import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditDevicePage({ params }: Props) {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Editing assets requires IT Staff or Admin access." />;
  const { id } = await params;
  const [device, ranges, employees, facturas, zones, devices] = await Promise.all([
    prisma.device.findUnique({
      where: { id },
      include: {
        sourceRelationships: { where: { status: "ACTIVE" } },
        targetRelationships: { where: { status: "ACTIVE" } },
      },
    }),
    prisma.ipRange.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], take: 100 }),
    prisma.locationZone.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.device.findMany({
      select: {
        id: true,
        name: true,
        assetTag: true,
        serialNumber: true,
        category: true,
        brand: true,
        model: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!device) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${device.name}`} description="Update inventory fields, status, assignment, and range membership." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <DeviceForm device={device} ranges={ranges} employees={employees} facturas={facturas} zones={zones} devices={devices} />
      </div>
    </div>
  );
}
