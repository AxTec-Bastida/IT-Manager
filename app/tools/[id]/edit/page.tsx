import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ToolLinkForm } from "@/components/tool-link-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditToolPage({ params }: Props) {
  const { id } = await params;
  const toolLink = await prisma.toolLink.findUnique({ where: { id } });
  if (!toolLink) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Edit resource" description={toolLink.name} />
      <ToolLinkForm toolLink={toolLink} />
    </div>
  );
}
