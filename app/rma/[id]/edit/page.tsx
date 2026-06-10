import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { RmaForm } from "@/components/rma-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditRmaPage({ params }: Props) {
  if (!(await hasPagePermission("rma.write"))) return <ForbiddenPanel message="Editing RMA cases requires IT Staff or Admin access." />;
  const { id } = await params;
  const [rma, devices] = await Promise.all([
    prisma.rmaCase.findUnique({ where: { id }, include: { items: { include: { device: { include: { employee: { select: { fullName: true } } } } } } } }),
    prisma.device.findMany({
      where: { status: { notIn: ["RETIRED", "DISPOSED", "LOST"] } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, assetTag: true, serialNumber: true, model: true, category: true, status: true, assignedTo: true, employeeId: true, employee: { select: { fullName: true } } },
    }),
  ]);
  if (!rma) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={`Edit RMA ${rma.rmaNumber}`} description="Update RMA details or add more devices to this repair batch." />
      <RmaForm devices={devices} rma={rma} />
    </div>
  );
}
