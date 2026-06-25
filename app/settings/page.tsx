import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ActionLink, PageActions, PolishedCard, KeyValueGrid, AlertPanel } from "@/components/ui-patterns";
import { getMailConfig } from "@/lib/mail";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPageRole } from "@/lib/page-permissions";
import { getCurrentUser } from "@/lib/auth";
import { Shield, Mail, Database, Terminal, User } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await hasPageRole("ADMIN"))) return <ForbiddenPanel message="Global settings are admin-only." />;

  const [settings, currentUser, userCount, deviceCount, stockCount, backupCount] = await Promise.all([
    prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } }),
    getCurrentUser(),
    prisma.appUser.count().catch(() => 0),
    prisma.device.count().catch(() => 0),
    prisma.stockItem.count().catch(() => 0),
    prisma.scheduledJob.count().catch(() => 0), // represents jobs count
  ]);

  const mailConfig = getMailConfig();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="System Settings & Status"
        description="General overview of the application configuration and system parameters."
        action={
          <PageActions>
            <ActionLink href="/admin" variant="primary">
              <Shield size={16} className="mr-1" />
              Admin Center
            </ActionLink>
            <ActionLink href="/admin/ui-preview" variant="subtle">UI Preview Lab</ActionLink>
          </PageActions>
        }
      />

      <AlertPanel title="Configuration Note" tone="info">
        Detailed configuration defaults, subnets, taxonomies, and notification rules are managed in the <a href="/admin" className="font-semibold underline">Admin Center</a>. SMTP secrets reside strictly in environment variables.
      </AlertPanel>

      <div className="grid gap-4 md:grid-cols-2">
        {/* App Information */}
        <PolishedCard
          eyebrow="Application"
          title="Site & Records Overview"
          description="High-level statistics of the local SQLite database."
        >
          <KeyValueGrid
            items={[
              { label: "Site Name", value: settings.siteName },
              { label: "Total Users", value: `${userCount} registered` },
              { label: "Inventory Assets", value: `${deviceCount} items` },
              { label: "Stock Items", value: `${stockCount} items` },
              { label: "Default Currency", value: settings.defaultCurrency },
            ]}
          />
        </PolishedCard>

        {/* Current User Session */}
        <PolishedCard
          eyebrow="Authentication"
          title="Current Session Profile"
          description="Your current authenticated user role and permission scopes."
        >
          <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4">
            <div className="rounded-full bg-slate-200 p-2.5 text-slate-800">
              <User size={20} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-950">{currentUser?.name || "System"}</p>
              <p className="text-sm text-slate-600">{currentUser?.email || "No email"}</p>
              <span className="mt-2 inline-flex rounded-full bg-slate-900 px-3.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-white">
                {currentUser?.role || "UNKNOWN"}
              </span>
            </div>
          </div>
        </PolishedCard>

        {/* SMTP Status */}
        <PolishedCard
          eyebrow="SMTP Integration"
          title="Email Status Overview"
          description="SMTP connectivity parameters mapped from environment secrets."
        >
          <KeyValueGrid
            items={[
              { label: "SMTP Configured", value: mailConfig.configured ? "Yes" : "No" },
              { label: "From Address", value: mailConfig.from || "Not configured" },
              { label: "Base App URL", value: mailConfig.appBaseUrl || "Not configured" },
            ]}
          />
          <div className="mt-4 flex gap-2">
            <ActionLink href="/admin/email-notifications" variant="subtle" className="inline-flex items-center gap-1">
              <Mail size={15} />
              Manage Notifications
            </ActionLink>
          </div>
        </PolishedCard>

        {/* System Diagnostics & Operations */}
        <PolishedCard
          eyebrow="Operations"
          title="Diagnostics & Tools"
          description="Direct access to backup exports, audit logs, and cron runs."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionLink href="/backups" className="inline-flex items-center justify-center gap-1.5 min-h-11">
              <Database size={16} />
              Database Backups
            </ActionLink>
            <ActionLink href="/jobs" className="inline-flex items-center justify-center gap-1.5 min-h-11">
              <Terminal size={16} />
              Scheduled Jobs ({backupCount})
            </ActionLink>
            <ActionLink href="/api/health" target="_blank" className="col-span-2 inline-flex items-center justify-center gap-1.5 min-h-11 border border-slate-300">
              Health Diagnostics (API)
            </ActionLink>
          </div>
        </PolishedCard>
      </div>
    </div>
  );
}
