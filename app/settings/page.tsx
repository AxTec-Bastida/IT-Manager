import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings-form";
import { ImportExportPanel } from "@/components/import-export-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure defaults and scanner safety controls for this site." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <SettingsForm settings={settings} />
      </div>
      <ImportExportPanel />
    </div>
  );
}
