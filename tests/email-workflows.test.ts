import { describe, expect, it } from "vitest";
import { autoWorkflowEmailEnabled, skippedAutoWorkflowEmail } from "@/lib/email-workflows";

const disabledSettings = {
  autoSendAssignmentReceipts: false,
  autoSendAssetLoanReceipts: false,
  autoSendOverdueReminderEmails: false,
};

describe("workflow email automation guards", () => {
  it("keeps assignment receipts manual unless the setting is enabled", () => {
    expect(autoWorkflowEmailEnabled({ ...disabledSettings, autoSendAssetLoanReceipts: true }, "assignment-receipt")).toBe(false);
    expect(autoWorkflowEmailEnabled({ ...disabledSettings, autoSendAssignmentReceipts: true }, "assignment-receipt")).toBe(true);
  });

  it("keeps asset loan receipts manual unless the setting is enabled", () => {
    expect(autoWorkflowEmailEnabled({ ...disabledSettings, autoSendAssignmentReceipts: true }, "asset-loan-checkout")).toBe(false);
    expect(autoWorkflowEmailEnabled({ ...disabledSettings, autoSendAssetLoanReceipts: true }, "asset-loan-checkout")).toBe(true);
  });

  it("keeps overdue reminder emails manual unless the setting is enabled", () => {
    expect(autoWorkflowEmailEnabled({ ...disabledSettings }, "overdue-reminder")).toBe(false);
    expect(autoWorkflowEmailEnabled({ ...disabledSettings, autoSendOverdueReminderEmails: true }, "overdue-reminder")).toBe(true);
  });

  it("returns a clear skipped result when automatic email is disabled", () => {
    expect(skippedAutoWorkflowEmail("assignment-receipt")).toMatchObject({
      success: false,
      skipped: true,
    });
    expect(skippedAutoWorkflowEmail("asset-loan-checkout").error).toContain("manual email action");
    expect(skippedAutoWorkflowEmail("overdue-reminder").error).toContain("Automatic overdue reminder emails are disabled");
  });
});
