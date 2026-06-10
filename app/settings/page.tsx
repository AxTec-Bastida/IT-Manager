import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings-form";
import { ImportExportPanel } from "@/components/import-export-panel";
import { ActionLink } from "@/components/ui-patterns";
import { TestEmailButton } from "@/components/test-email-button";
import { getMailConfig } from "@/lib/mail";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPageRole } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await hasPageRole("ADMIN"))) return <ForbiddenPanel message="Global settings are admin-only." />;
  const settings = await prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const mailConfig = getMailConfig();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure defaults and scanner safety controls for this site." action={<ActionLink href="/backups">Backups</ActionLink>} />
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Email</h2>
        <p className="mt-1 text-sm text-slate-500">SMTP credentials stay in environment variables and are never shown here.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Info label="SMTP configured" value={mailConfig.configured ? "Yes" : "No"} />
          <Info label="MAIL_FROM" value={mailConfig.from || "Not configured"} />
          <Info label="APP_BASE_URL" value={mailConfig.appBaseUrl || "Not configured"} />
        </div>
        {mailConfig.missing.length ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Missing: {mailConfig.missing.join(", ")}. Workflow records still save normally; email attempts will be logged as skipped.</p> : null}
        <div className="mt-4">
          <TestEmailButton />
        </div>
      </section>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <SettingsForm settings={settings} />
      </div>
      <ImportExportPanel />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-medium text-slate-950">{value}</p></div>;
}
