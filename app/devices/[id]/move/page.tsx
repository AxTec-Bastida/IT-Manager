import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EquipmentMoveForm } from "@/components/equipment-move-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { prisma } from "@/lib/prisma";
import { getAssetDisplayName } from "@/lib/asset-display";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function DeviceMovePage({ params }: Props) {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Moving or relocating assets requires IT Staff or Admin access." />;
  const { id } = await params;
  const [device, ranges, anchors] = await Promise.all([
    prisma.device.findUnique({
      where: { id },
      include: {
        employee: { select: { fullName: true } },
        assignmentItems: {
          where: { returnedAt: null, assignment: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } },
          include: { assignment: { select: { assignmentNumber: true } } },
          take: 1,
        },
        assetLoanItems: {
          where: { returnStatus: "PENDING", loan: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] } } },
          include: { loan: { select: { loanNumber: true, status: true } } },
          take: 1,
        },
        rmaItems: {
          where: { result: "PENDING", rmaCase: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } },
          include: { rmaCase: { select: { rmaNumber: true, status: true } } },
          take: 1,
        },
      },
    }),
    prisma.ipRange.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.accessPointMapLocation.findMany({
      where: { active: true },
      include: { map: { select: { name: true } } },
      orderBy: [{ displayPath: "asc" }, { locationLabel: "asc" }],
    }),
  ]);
  if (!device) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Move / Relocate ${getAssetDisplayName(device)}`} description="Guided phone-first workflow for updating area, station, and placement without changing assignment, loan, RMA, or network data." />
      <EquipmentMoveForm
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
          activeAssignment: device.assignmentItems[0]?.assignment.assignmentNumber ?? null,
          activeLoan: device.assetLoanItems[0] ? `Loan ${device.assetLoanItems[0].loan.loanNumber} is ${device.assetLoanItems[0].loan.status.replaceAll("_", " ")}.` : null,
          activeRma: device.rmaItems[0] ? `RMA ${device.rmaItems[0].rmaCase.rmaNumber} is ${device.rmaItems[0].rmaCase.status.replaceAll("_", " ")}.` : null,
          currentMapAnchorId: device.currentMapAnchorId,
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
        anchors={anchors.map((anchor) => ({
          id: anchor.id,
          apName: anchor.apName,
          locationLabel: anchor.locationLabel,
          area: anchor.area,
          department: anchor.department,
          station: anchor.station,
          displayPath: anchor.displayPath,
          mapName: anchor.map?.name ?? null,
        }))}
      />
    </div>
  );
}
