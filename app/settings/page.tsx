import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings-form";
import { ImportExportPanel } from "@/components/import-export-panel";
import { ActionLink, PageActions } from "@/components/ui-patterns";
import { TestEmailButton } from "@/components/test-email-button";
import { getMailConfig, getSanitizedMailStatus } from "@/lib/mail";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPageRole } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await hasPageRole("ADMIN"))) return <ForbiddenPanel message="Global settings are admin-only." />;
  const settings = await prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const mailConfig = getMailConfig();
  const mailStatus = getSanitizedMailStatus();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure defaults and scanner safety controls for this site."
        action={
          <PageActions>
            <ActionLink href="/admin/ui-preview" variant="subtle">UI Preview Lab</ActionLink>
            <ActionLink href="/backups">Backups</ActionLink>
          </PageActions>
        }
      />
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Email</h2>
        <p className="mt-1 text-sm text-slate-500">SMTP credentials stay in environment variables and are never shown here.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Info label="SMTP configured" value={mailConfig.configured ? "Yes" : "No"} />
          <Info label="Host present" value={mailStatus.hostPresent ? "Yes" : "No"} />
          <Info label="From present" value={mailStatus.fromPresent ? "Yes" : "No"} />
          <Info label="Port" value={`${mailStatus.port}${mailStatus.portPresent ? "" : " (default)"}`} />
          <Info label="Secure mode" value={mailStatus.secure ? "Yes" : "No"} />
          <Info label="Auth present" value={mailStatus.authPresent ? "Yes" : mailStatus.authPartial ? "Partial" : "No"} />
          <Info label="Sender" value={mailConfig.from || "Not configured"} />
          <Info label="APP_BASE_URL" value={mailConfig.appBaseUrl || "Not configured"} />
        </div>
        {mailConfig.missing.length ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Missing: {mailConfig.missing.join(", ")}. Workflow records still save normally; email attempts will be logged as skipped.</p> : null}
        {mailStatus.authPartial ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">SMTP auth is partially configured. Set both SMTP_USER and SMTP_PASS, or leave both blank for an internal relay.</p> : null}
        {mailStatus.appBaseUrlLocalhost ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">APP_BASE_URL is localhost, so email links will only work on this server. Use the LAN beta URL for phone/team testing.</p> : null}
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
