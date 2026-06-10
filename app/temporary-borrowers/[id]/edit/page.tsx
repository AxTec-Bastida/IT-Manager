import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { TemporaryBorrowerForm } from "@/components/temporary-borrower-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditTemporaryBorrowerPage({ params }: Props) {
  if (!(await hasPagePermission("stock.write"))) return <ForbiddenPanel message="Editing temporary borrowers requires IT Staff or Admin access." />;
  const { id } = await params;
  const borrower = await prisma.temporaryBorrower.findUnique({ where: { id } });
  if (!borrower) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${borrower.name}`} description="Update temporary borrower details or deactivate the temporary record." />
      <TemporaryBorrowerForm borrower={borrower} />
    </div>
  );
}
