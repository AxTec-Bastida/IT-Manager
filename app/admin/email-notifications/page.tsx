import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPageRole } from "@/lib/page-permissions";
import { EmailSettingsForm } from "@/components/email-settings-form";
import { getSanitizedMailStatus, getMailConfig } from "@/lib/mail";

export const dynamic = "force-dynamic";

export default async function AdminEmailNotificationsPage() {
  if (!(await hasPageRole("ADMIN"))) {
    return <ForbiddenPanel message="Email settings are admin-only." />;
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  const mailStatus = getSanitizedMailStatus();
  const mailConfig = getMailConfig();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Email & Notifications"
        description="Verify SMTP configuration status and control automated email rules."
      />
      <EmailSettingsForm settings={settings} mailStatus={mailStatus} mailConfig={mailConfig} />
    </div>
  );
}
