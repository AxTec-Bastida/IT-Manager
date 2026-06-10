import { prisma } from "@/lib/prisma";
import { DeviceForm } from "@/components/device-form";
import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function NewDevicePage() {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Adding assets requires IT Staff or Admin access." />;
  const [ranges, settings, employees, facturas, zones] = await Promise.all([
    prisma.ipRange.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], take: 100 }),
    prisma.locationZone.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Add device" description="Create a new inventory record or static IP reservation." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <DeviceForm ranges={ranges} employees={employees} facturas={facturas} zones={zones} defaults={{ vlan: settings.defaultVlan, category: settings.defaultCategory }} />
      </div>
    </div>
  );
}
