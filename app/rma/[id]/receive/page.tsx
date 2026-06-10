import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { RmaReceiveForm } from "@/components/rma-receive-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ReceiveRmaPage({ params }: Props) {
  if (!(await hasPagePermission("rma.write"))) return <ForbiddenPanel message="Receiving RMA devices requires IT Staff or Admin access." />;
  const { id } = await params;
  const [rma, devices] = await Promise.all([
    prisma.rmaCase.findUnique({ where: { id }, include: { items: { include: { device: true, replacementDevice: true }, orderBy: { createdAt: "asc" } } } }),
    prisma.device.findMany({ where: { status: { notIn: ["DISPOSED"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, assetTag: true, serialNumber: true } }),
  ]);
  if (!rma) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={`Receive RMA ${rma.rmaNumber}`} description="Receive repaired, replaced, rejected, lost, or retired devices while preserving RMA history." />
      <RmaReceiveForm rma={rma} devices={devices} />
    </div>
  );
}
