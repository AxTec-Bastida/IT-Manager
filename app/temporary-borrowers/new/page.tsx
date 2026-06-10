import { PageHeader } from "@/components/page-header";
import { TemporaryBorrowerForm } from "@/components/temporary-borrower-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewTemporaryBorrowerPage({ searchParams }: Props) {
  if (!(await hasPagePermission("stock.write"))) return <ForbiddenPanel message="Creating temporary borrowers requires IT Staff or Admin access." />;
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader title="New Temporary Borrower" description="Create a quick temporary ID for contractors, visitors, or unregistered users." />
      <TemporaryBorrowerForm defaultName={typeof params.name === "string" ? params.name : ""} />
    </div>
  );
}
