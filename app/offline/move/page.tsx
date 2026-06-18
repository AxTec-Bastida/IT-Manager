import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { OfflineMoveForm } from "@/components/offline-move-form";
import { getAssetDisplayName } from "@/lib/asset-display";
import { canPerformAction, getCurrentUser } from "@/lib/auth";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    deviceId?: string;
    assetTag?: string;
  }>;
};

export default async function OfflineMovePage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/offline/move");
  if (!canPerformAction(user, "inventory.write")) return <ForbiddenPanel message="Queueing offline asset moves requires IT Staff or Admin access." />;
  const query = searchParams ? await searchParams : {};
  const [device, anchors] = await Promise.all([
    query.deviceId || query.assetTag
      ? prisma.device.findFirst({
          where: { OR: [{ id: query.deviceId || "__none__" }, { assetTag: query.assetTag || "__none__" }] },
          include: {
            assignmentItems: {
              where: { returnedAt: null, assignment: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } },
              select: { assignmentId: true },
              take: 1,
            },
          },
        })
      : Promise.resolve(null),
    prisma.accessPointMapLocation.findMany({
      where: { active: true },
      include: { map: { select: { name: true } } },
      orderBy: [{ displayPath: "asc" }, { locationLabel: "asc" }],
    }),
  ]);

  const initialAsset = device
    ? {
        deviceId: device.id,
        assetTag: device.assetTag,
        name: getAssetDisplayName(device),
        status: device.status,
        location: device.location,
        areaDepartment: device.areaDepartment,
        currentMapAnchorId: device.currentMapAnchorId,
        activeAssignmentId: device.assignmentItems[0]?.assignmentId ?? null,
      }
    : {
        assetTag: query.assetTag ?? "",
      };

  return (
    <div className="space-y-6">
      <PageHeader title="Queue Offline Move" description="Scan or enter an asset tag, choose the destination, and sync later. The server validates everything before applying the move." />
      <OfflineMoveForm
        userId={user.id}
        appVersion="0.1.0"
        initialAsset={initialAsset}
        anchors={anchors.map((anchor) => ({
          id: anchor.id,
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
