import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildAssetLoanOverdueEmail, buildAssetLoanCheckoutEmail } from "@/lib/email-templates";
import { sendAssetLoanWorkflowEmail } from "@/lib/email-workflows";
import { runAssetLoanOverdueCheck } from "@/lib/jobs";
import { sendAndLogEmail } from "@/lib/mail";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/mail", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mail")>("@/lib/mail");
  return {
    ...actual,
    sendAndLogEmail: vi.fn().mockResolvedValue({ success: true, logId: "log-2" }),
  };
});

describe("Asset Loan Overdue/Due Reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLoan = {
    id: "loan-1",
    loanNumber: "AL-1001",
    loanStartAt: new Date("2026-06-20T00:00:00Z"),
    expectedReturnAt: new Date("2026-06-25T00:00:00Z"),
    checkoutNotes: "Please return on time.",
    employee: {
      fullName: "Memo Bastida",
      email: "memo@g-global.com",
      supervisorEmail: "supervisor@g-global.com",
    },
    temporaryBorrower: null,
    emailTo: null,
    emailCc: null,
    emailSentAt: null,
    emailError: null,
    signatureData: null,
    items: [
      {
        deviceId: "device-1",
        conditionOut: "GOOD" as const,
        device: {
          id: "device-1",
          name: "Test Laptop",
          assetTag: "GHT-LP-001",
          serialNumber: "SN12345",
        },
      },
    ],
  };

  it("builds the correct email body when the loan is overdue", () => {
    const input = buildAssetLoanOverdueEmail(mockLoan, "memo@g-global.com", "supervisor@g-global.com");
    expect(input.to).toBe("memo@g-global.com");
    expect(input.cc).toBe("supervisor@g-global.com");
    expect(input.subject).toContain("OVERDUE REMINDER");
    expect(input.html).toContain("OVERDUE");
    expect(input.html).toContain("GHT-LP-001");
  });

  it("builds the correct email body when the loan is due today", () => {
    // Make expected return date match today's date
    const loanDueToday = {
      ...mockLoan,
      expectedReturnAt: new Date(),
    };
    const input = buildAssetLoanOverdueEmail(loanDueToday, "memo@g-global.com", "supervisor@g-global.com");
    expect(input.subject).toContain("DUE DATE REMINDER");
    expect(input.html).toContain("DUE TODAY");
  });

  it("enriches checkout email with borrower signature and device photos", () => {
    const loanWithEnrichment = {
      ...mockLoan,
      signatureData: "data:image/png;base64,mockSignatureSignatureSignature",
      items: [
        {
          ...mockLoan.items[0],
          device: {
            ...mockLoan.items[0].device,
            photos: [
              {
                id: "photo-1",
                filePath: "/uploads/assets/device-photo.jpg",
                thumbnailPath: "/uploads/assets/device-photo-thumb.jpg",
                caption: "Front View",
                isPrimary: true,
              },
            ],
          },
        },
      ],
    };

    const input = buildAssetLoanCheckoutEmail(loanWithEnrichment, "memo@g-global.com", "supervisor@g-global.com");

    // HTML checks
    expect(input.html).toContain("Equipment Photos");
    expect(input.html).toContain("device-photo-thumb.jpg");
    expect(input.html).toContain("Front View");
    expect(input.html).toContain("Signature");
    expect(input.html).toContain("mockSignatureSignatureSignature");

    // Text checks
    expect(input.text).toContain("Equipment Photos:");
    expect(input.text).toContain("device-photo.jpg");
    expect(input.text).toContain("Signature captured");
  });

  it("triggers the overdue reminder mail flow using sendAssetLoanWorkflowEmail", async () => {
    const mockPrisma = {
      assetLoan: {
        findUnique: vi.fn().mockResolvedValue(mockLoan),
      },
    } as unknown as PrismaClient;

    const result = await sendAssetLoanWorkflowEmail(mockPrisma, "loan-1", "overdue");

    expect(result.success).toBe(true);
    expect(sendAndLogEmail).toHaveBeenCalledWith(
      mockPrisma,
      "OVERDUE_ASSET_LOAN_REMINDER",
      expect.objectContaining({
        to: "memo@g-global.com",
        subject: expect.stringContaining("REMINDER"),
      }),
      { assetLoanId: "loan-1", relatedDeviceId: "device-1" },
      expect.anything()
    );
  });

  it("respects custom emailTo and emailCc overrides on the loan record", async () => {
    const mockLoanWithOverrides = {
      ...mockLoan,
      emailTo: "custom-borrower@g-global.com",
      emailCc: "custom-cc@g-global.com",
    };
    const mockPrisma = {
      assetLoan: {
        findUnique: vi.fn().mockResolvedValue(mockLoanWithOverrides),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaClient;

    const result = await sendAssetLoanWorkflowEmail(mockPrisma, "loan-1", "checkout");

    expect(result.success).toBe(true);
    expect(sendAndLogEmail).toHaveBeenCalledWith(
      mockPrisma,
      "ASSET_LOAN_CHECKOUT",
      expect.objectContaining({
        to: "custom-borrower@g-global.com",
        cc: expect.stringContaining("custom-cc@g-global.com"),
      }),
      { assetLoanId: "loan-1", relatedDeviceId: "device-1" },
      expect.anything()
    );
  });

  it("sends reminder via scheduled job when expectedReturnAt is <= today and no reminder sent today", async () => {
    const mockPrisma = {
      assetLoan: {
        findMany: vi.fn().mockResolvedValue([mockLoan]),
        update: vi.fn(),
      },
      appSettings: {
        upsert: vi.fn().mockResolvedValue({
          autoSendAssignmentReceipts: false,
          autoSendAssetLoanReceipts: false,
          autoSendOverdueReminderEmails: true,
        }),
      },
      alert: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      emailLog: {
        findFirst: vi.fn().mockResolvedValue(null), // simulate NO email sent today
      },
      activityLog: {
        create: vi.fn(),
      },
    } as unknown as PrismaClient;

    // Spy on sendAssetLoanWorkflowEmail to mock it out during job execution
    const sendWorkflowEmailSpy = vi.spyOn(
      await import("@/lib/email-workflows"),
      "sendAssetLoanWorkflowEmail"
    ).mockResolvedValue({ success: true });

    const result = await runAssetLoanOverdueCheck(mockPrisma, new Date("2026-06-27T12:00:00Z"));

    expect(result.loansChecked).toBe(1);
    expect(result.emailsSent).toBe(1);
    expect(sendWorkflowEmailSpy).toHaveBeenCalledWith(mockPrisma, "loan-1", "overdue");
  });

  it("does not send email via scheduled job when overdue email automation is disabled", async () => {
    const mockPrisma = {
      assetLoan: {
        findMany: vi.fn().mockResolvedValue([mockLoan]),
        update: vi.fn(),
      },
      appSettings: {
        upsert: vi.fn().mockResolvedValue({
          autoSendAssignmentReceipts: false,
          autoSendAssetLoanReceipts: false,
          autoSendOverdueReminderEmails: false,
        }),
      },
      alert: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      emailLog: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      activityLog: {
        create: vi.fn(),
      },
    } as unknown as PrismaClient;

    const sendWorkflowEmailSpy = vi.spyOn(
      await import("@/lib/email-workflows"),
      "sendAssetLoanWorkflowEmail"
    );

    const result = await runAssetLoanOverdueCheck(mockPrisma, new Date("2026-06-27T12:00:00Z"));

    expect(result.loansChecked).toBe(1);
    expect(result.emailsSent).toBe(0);
    expect(result.emailsSkipped).toBe(1);
    expect(sendWorkflowEmailSpy).not.toHaveBeenCalled();
  });
});
