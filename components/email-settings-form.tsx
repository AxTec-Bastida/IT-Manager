"use client";

import { useState } from "react";
import { Mail, ShieldCheck, ShieldAlert, Send, HelpCircle, Save } from "lucide-react";
import type { AppSettings } from "@prisma/client";
import type { SanitizedMailStatus, MailConfig } from "@/lib/mail";
import { actionButtonClass } from "@/components/ui-patterns";
import { useRouter } from "next/navigation";

export function EmailSettingsForm({
  settings,
  mailStatus,
  mailConfig,
}: {
  settings: AppSettings;
  mailStatus: SanitizedMailStatus;
  mailConfig: MailConfig;
}) {
  const router = useRouter();
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  // States for toggles
  const [autoSendAssignmentReceipts, setAutoSendAssignmentReceipts] = useState(settings.autoSendAssignmentReceipts);
  const [autoSendAssetLoanReceipts, setAutoSendAssetLoanReceipts] = useState(settings.autoSendAssetLoanReceipts);
  const [autoSendStockIssueReceipts, setAutoSendStockIssueReceipts] = useState(settings.autoSendStockIssueReceipts);
  const [autoSendRmaEmails, setAutoSendRmaEmails] = useState(settings.autoSendRmaEmails);
  const [autoSendReturnConfirmations, setAutoSendReturnConfirmations] = useState(settings.autoSendReturnConfirmations);
  const [autoSendOverdueReminderEmails, setAutoSendOverdueReminderEmails] = useState(settings.autoSendOverdueReminderEmails);

  const checkboxClass = "flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer";
  const labelClass = "text-sm font-semibold text-slate-700 block mb-1";

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail.trim()) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ success: true, message: `Test email sent successfully! Message ID: ${data.messageId}` });
      } else {
        setTestResult({ success: false, message: data.error || "Failed to send test email." });
      }
    } catch {
      setTestResult({ success: false, message: "An unexpected error occurred." });
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveResult(null);

    // Merge updated notification parameters with existing settings
    const payload = {
      // Re-submit the required AppSettings schema fields using current database defaults
      siteName: settings.siteName,
      defaultVlan: settings.defaultVlan,
      defaultCategory: settings.defaultCategory,
      maxScanSize: settings.maxScanSize,
      pingTimeoutMs: settings.pingTimeoutMs,
      autoSaveScanResults: settings.autoSaveScanResults,
      defaultLowStockThreshold: settings.defaultLowStockThreshold,
      defaultThermalCleaningIntervalDays: settings.defaultThermalCleaningIntervalDays,
      defaultMfpLowSupplyThreshold: settings.defaultMfpLowSupplyThreshold,
      enablePrinterMaintenanceAlerts: settings.enablePrinterMaintenanceAlerts,
      enableLowStockAlerts: settings.enableLowStockAlerts,
      enableConflictAlerts: settings.enableConflictAlerts,
      enableWarrantyAlerts: settings.enableWarrantyAlerts,
      warrantyAlertThresholdDays: settings.warrantyAlertThresholdDays,
      enableMovementAlerts: settings.enableMovementAlerts,
      defaultAllowedZoneDistance: settings.defaultAllowedZoneDistance,
      autoResolveMovementAlerts: settings.autoResolveMovementAlerts,
      enableMissingAssetSeenOnlineAlerts: settings.enableMissingAssetSeenOnlineAlerts,
      alertDuplicateSuppressionEnabled: settings.alertDuplicateSuppressionEnabled,
      defaultCurrency: settings.defaultCurrency,

      // Our modified email toggles
      autoSendAssignmentReceipts,
      autoSendAssetLoanReceipts,
      autoSendStockIssueReceipts,
      autoSendRmaEmails,
      autoSendReturnConfirmations,
      autoSendOverdueReminderEmails,
    };

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveResult({ success: true, message: "Notification settings saved successfully." });
        router.refresh();
      } else {
        const data = await res.json();
        setSaveResult({ success: false, message: data.error || "Unable to save settings." });
      }
    } catch {
      setSaveResult({ success: false, message: "An unexpected error occurred while saving." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* SMTP Connection Diagnostics */}
      <div className="lg:col-span-1 space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
            <Mail size={18} />
            SMTP Server Diagnostics
          </h2>

          {!mailStatus.configured ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950 flex gap-2">
              <ShieldAlert className="size-5 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">SMTP Missing / Disabled</p>
                <p className="mt-1">Email sending is disabled until SMTP credentials are configured.</p>
                <p className="mt-2 text-xs font-semibold">Missing env keys: {mailStatus.missing.join(", ")}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 flex gap-2">
              <ShieldCheck className="size-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">SMTP Configured & Active</p>
                <p className="mt-1">Nodemailer integration is active. Outbound notifications will attempt to send.</p>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100 text-sm space-y-3 pt-2">
            <div className="flex justify-between pt-2">
              <span className="text-slate-600">SMTP Server Host</span>
              <span className="font-mono text-slate-900 font-semibold">{mailStatus.hostPresent ? "Present" : "Missing"}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-600">SMTP Port</span>
              <span className="font-mono text-slate-900 font-semibold">{mailStatus.port}</span>
            </div>
            <span className="block border-t border-slate-100 my-1" />
            <div className="flex justify-between pt-2">
              <span className="text-slate-600">SSL / TLS Mode</span>
              <span className="font-mono text-slate-900 font-semibold">{mailStatus.secure ? "Secure (SSL)" : "STARTTLS"}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-600">Credentials Present</span>
              <span className="font-mono text-slate-900 font-semibold">{mailStatus.authPresent ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-600">From Address</span>
              <span className="font-mono text-slate-900 font-semibold truncate max-w-44" title={mailConfig.from}>
                {mailConfig.from || "None"}
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500 leading-relaxed space-y-1">
            <p className="font-semibold text-slate-700">Security Guardrail</p>
            <p>SMTP passwords, tokens, and secret variables are stored exclusively in the system environment (`.env`) and are never exposed in logs, database fields, or the user interface.</p>
          </div>
        </section>

        {/* Send Test Email Card */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
            <Send size={16} />
            Outbound Email Test
          </h2>
          <p className="text-xs text-slate-600">Verify SMTP transport connectivity by sending a test message.</p>

          <form onSubmit={handleSendTest} className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700 space-y-1">
              <span>Recipient Email</span>
              <input
                type="email"
                required
                disabled={!mailStatus.configured || testing}
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="e.g. it.techstyle@g-global.com"
                className="w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none disabled:opacity-60"
              />
            </label>
            <button
              type="submit"
              disabled={!mailStatus.configured || testing}
              className={`${actionButtonClass("secondary")} w-full min-h-10 justify-center`}
            >
              {testing ? "Sending..." : "Send Test Email"}
            </button>
          </form>

          {testResult && (
            <div
              className={`rounded-lg border p-3 text-xs leading-normal ${
                testResult.success
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-rose-200 bg-rose-50 text-rose-950"
              }`}
            >
              <p className="font-bold">{testResult.success ? "Connection OK" : "Connection Failed"}</p>
              <p className="mt-1 font-mono whitespace-pre-wrap">{testResult.message}</p>
            </div>
          )}
        </section>
      </div>

      {/* Rules and CC default configurations */}
      <div className="lg:col-span-2 space-y-4">
        {saveResult && (
          <div
            className={`rounded-lg border p-4 text-sm flex gap-3 items-start ${
              saveResult.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-rose-200 bg-rose-50 text-rose-950"
            }`}
          >
            {saveResult.success ? (
              <ShieldCheck className="shrink-0 size-5 text-emerald-700" />
            ) : (
              <ShieldAlert className="shrink-0 size-5 text-rose-700" />
            )}
            <div>
              <p className="font-semibold">{saveResult.success ? "Success" : "Error Saving Settings"}</p>
              <p className="mt-0.5">{saveResult.message}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-950">Automated Notification Rules</h2>
            <p className="text-xs text-slate-600">Select which operational events trigger automated email receipts.</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className={checkboxClass}>
                <input
                  type="checkbox"
                  checked={autoSendAssignmentReceipts}
                  onChange={(e) => setAutoSendAssignmentReceipts(e.target.checked)}
                  className="size-4 mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Assignment Created</p>
                  <p className="text-slate-500 mt-0.5">Email receipt sent to assignee upon equipment checkout.</p>
                </div>
              </label>

              <label className={checkboxClass}>
                <input
                  type="checkbox"
                  checked={autoSendAssetLoanReceipts}
                  onChange={(e) => setAutoSendAssetLoanReceipts(e.target.checked)}
                  className="size-4 mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Asset Loan Checked Out</p>
                  <p className="text-slate-500 mt-0.5">Notification triggered when asset is issued for temporary loan.</p>
                </div>
              </label>

              <label className={checkboxClass}>
                <input
                  type="checkbox"
                  checked={autoSendStockIssueReceipts}
                  onChange={(e) => setAutoSendStockIssueReceipts(e.target.checked)}
                  className="size-4 mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Stock Items Dispatched</p>
                  <p className="text-slate-500 mt-0.5">Receipt sent to supervisor or employee when toner/cables are issued.</p>
                </div>
              </label>

              <label className={checkboxClass}>
                <input
                  type="checkbox"
                  checked={autoSendRmaEmails}
                  onChange={(e) => setAutoSendRmaEmails(e.target.checked)}
                  className="size-4 mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-900">RMA Case Activity</p>
                  <p className="text-slate-500 mt-0.5">Email alerts sent when repairs are created or updated.</p>
                </div>
              </label>

              <label className={checkboxClass}>
                <input
                  type="checkbox"
                  checked={autoSendReturnConfirmations}
                  onChange={(e) => setAutoSendReturnConfirmations(e.target.checked)}
                  className="size-4 mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Loan Returns Registered</p>
                  <p className="text-slate-500 mt-0.5">Receipt generated immediately when loan device returns to pool.</p>
                </div>
              </label>

              <label className={checkboxClass}>
                <input
                  type="checkbox"
                  checked={autoSendOverdueReminderEmails}
                  onChange={(e) => setAutoSendOverdueReminderEmails(e.target.checked)}
                  className="size-4 mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Overdue Reminders</p>
                  <p className="text-slate-500 mt-0.5">Automated job alerts for loans exceeding expected return dates.</p>
                </div>
              </label>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <HelpCircle size={14} />
                Some actions trigger async via cron jobs.
              </span>
              <button
                type="submit"
                disabled={saving}
                className={`${actionButtonClass("primary")} min-h-11`}
              >
                <Save size={16} className="mr-1.5" />
                Save Notification Rules
              </button>
            </div>
          </section>
        </form>

        {/* Recipient Groups / CC Routing Matrix */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-950">Recipient CC Routing Matrix</h2>
          <p className="text-xs text-slate-600">Current routing addresses resolved from config variables for escalation/CC targets.</p>

          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="font-semibold text-slate-900">Default IT CC Mailbox</p>
              <p className="font-mono text-slate-700 text-xs mt-1">it.techstyle@g-global.com</p>
              <span className="mt-2 inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-semibold text-slate-800 border border-slate-900/10">
                Primary CC Target
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="font-semibold text-slate-900">IT_NOTIFICATION_CC</p>
              <p className="font-mono text-slate-700 text-xs mt-1 truncate" title={mailConfig.defaultCc}>
                {mailConfig.defaultCc || "Fallback to default IT"}
              </p>
              <span className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                Env Variable
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="font-semibold text-slate-900">IT_ASSIGNMENT_CC</p>
              <p className="font-mono text-slate-700 text-xs mt-1 truncate">
                {mailConfig.workflowCc.assignment || "Fallback to IT_NOTIFICATION_CC"}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="font-semibold text-slate-900">IT_LOAN_CC</p>
              <p className="font-mono text-slate-700 text-xs mt-1 truncate">
                {mailConfig.workflowCc.loan || "Fallback to IT_NOTIFICATION_CC"}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="font-semibold text-slate-900">IT_RMA_CC</p>
              <p className="font-mono text-slate-700 text-xs mt-1 truncate">
                {mailConfig.workflowCc.rma || "Fallback to IT_NOTIFICATION_CC"}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="font-semibold text-slate-900">IT_STOCK_CC</p>
              <p className="font-mono text-slate-700 text-xs mt-1 truncate">
                {mailConfig.workflowCc.stock || "Fallback to IT_NOTIFICATION_CC"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
