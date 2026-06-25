import { describe, expect, it } from "vitest";
import { autoWorkflowEmailEnabled, skippedAutoWorkflowEmail } from "@/lib/email-workflows";

describe("workflow email automation guards", () => {
  it("keeps assignment receipts manual unless the setting is enabled", () => {
    expect(autoWorkflowEmailEnabled({ autoSendAssignmentReceipts: false, autoSendAssetLoanReceipts: true }, "assignment-receipt")).toBe(false);
    expect(autoWorkflowEmailEnabled({ autoSendAssignmentReceipts: true, autoSendAssetLoanReceipts: false }, "assignment-receipt")).toBe(true);
  });

  it("keeps asset loan receipts manual unless the setting is enabled", () => {
    expect(autoWorkflowEmailEnabled({ autoSendAssignmentReceipts: true, autoSendAssetLoanReceipts: false }, "asset-loan-checkout")).toBe(false);
    expect(autoWorkflowEmailEnabled({ autoSendAssignmentReceipts: false, autoSendAssetLoanReceipts: true }, "asset-loan-checkout")).toBe(true);
  });

  it("returns a clear skipped result when automatic email is disabled", () => {
    expect(skippedAutoWorkflowEmail("assignment-receipt")).toMatchObject({
      success: false,
      skipped: true,
    });
    expect(skippedAutoWorkflowEmail("asset-loan-checkout").error).toContain("manual email action");
  });
});
