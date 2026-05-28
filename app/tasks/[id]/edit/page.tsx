import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/task-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditTaskPage({ params }: Props) {
  const { id } = await params;
  const [task, devices, employees, stockItems, facturas, alerts] = await Promise.all([
    prisma.task.findUnique({ where: { id } }),
    prisma.device.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, assetTag: true } }),
    prisma.employee.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, employeeId: true } }),
    prisma.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
    prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], select: { id: true, facturaNumber: true, vendorName: true } }),
    prisma.alert.findMany({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } }, orderBy: { lastSeenAt: "desc" }, take: 100, select: { id: true, title: true } }),
  ]);
  if (!task) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Edit task" description={task.title} />
      <TaskForm task={task} devices={devices} employees={employees} stockItems={stockItems} facturas={facturas} alerts={alerts} />
    </div>
  );
}
