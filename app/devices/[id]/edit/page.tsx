import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DeviceForm } from "@/components/device-form";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditDevicePage({ params }: Props) {
  const { id } = await params;
  const [device, ranges, employees, facturas, zones] = await Promise.all([
    prisma.device.findUnique({ where: { id } }),
    prisma.ipRange.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], take: 100 }),
    prisma.locationZone.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!device) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${device.name}`} description="Update inventory fields, status, assignment, and range membership." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <DeviceForm device={device} ranges={ranges} employees={employees} facturas={facturas} zones={zones} />
      </div>
    </div>
  );
}
