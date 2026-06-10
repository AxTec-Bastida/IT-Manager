import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EquipmentInstallForm } from "@/components/equipment-install-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { prisma } from "@/lib/prisma";
import { getAssetDisplayName } from "@/lib/asset-display";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function DeviceInstallPage({ params }: Props) {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Install / commission requires IT Staff or Admin access." />;
  const { id } = await params;
  const [device, ranges] = await Promise.all([
    prisma.device.findUnique({
      where: { id },
      include: { employee: { select: { fullName: true } } },
    }),
    prisma.ipRange.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ]);
  if (!device) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Install / Commission ${getAssetDisplayName(device)}`} description="Guided phone-first setup for location, IP, MAC, and static tracking." />
      <EquipmentInstallForm
        device={{
          id: device.id,
          name: getAssetDisplayName(device),
          assetTag: device.assetTag,
          serialNumber: device.serialNumber,
          category: device.category,
          status: device.status,
          condition: device.condition,
          location: device.location,
          areaDepartment: device.areaDepartment,
          ipAddress: device.ipAddress,
          macAddress: device.macAddress,
          vlan: device.vlan,
          usesStaticIp: device.usesStaticIp,
          isFixedAsset: device.isFixedAsset,
          employee: device.employee,
        }}
        ranges={ranges.map((range) => ({
          id: range.id,
          name: range.name,
          category: range.category,
          vlan: range.vlan,
          startIp: range.startIp,
          endIp: range.endIp,
          location: range.location,
        }))}
      />
    </div>
  );
}
