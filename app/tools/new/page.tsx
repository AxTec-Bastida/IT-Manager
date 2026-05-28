import { PageHeader } from "@/components/page-header";
import { ToolLinkForm } from "@/components/tool-link-form";

export const dynamic = "force-dynamic";

export default function NewToolPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New resource" description="Add a quick link to an IT tool, portal, SOP, or vendor page." />
      <ToolLinkForm />
    </div>
  );
}
