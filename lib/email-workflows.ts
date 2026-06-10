import type { EmailLogType, PrismaClient } from "@prisma/client";
import { buildAssetLoanCheckoutEmail, buildAssetLoanReturnEmail, buildAssignmentReceiptEmail, buildAssignmentReturnEmail, buildRmaClosedEmail, buildRmaFollowUpEmail, buildRmaSentEmail, buildStockIssueEmail, buildStockReturnEmail } from "./email-templates";
import { getMailConfig, sendAndLogEmail, workflowCc, type MailSendInput } from "./mail";

export type WorkflowEmailResult = {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
  logId?: string;
};

export async function sendAssignmentWorkflowEmail(prisma: PrismaClient, assignmentId: string, kind: "receipt" | "return", recipientOverride?: string | null): Promise<WorkflowEmailResult> {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { employee: true, items: { include: { asset: true } } } });
  if (!assignment) return skipped("Assignment not found.");
  const config = getMailConfig();
  const to = recipientOverride || assignment.employee?.email;
  const cc = workflowCc("assignment", config);
  const input = kind === "return" ? buildAssignmentReturnEmail(assignment, to, cc, config) : buildAssignmentReceiptEmail(assignment, to, cc, config);
  const type: EmailLogType = kind === "return" ? "ASSIGNMENT_RETURN_CONFIRMATION" : "ASSIGNMENT_RECEIPT";
  const result = await sendAndLogEmail(prisma, type, input, { assignmentId: assignment.id, relatedDeviceId: assignment.items[0]?.assetId ?? null }, config);
  if (kind === "receipt") {
    await prisma.assignment.update({
      where: { id: assignment.id },
      data: {
        emailSentAt: result.success ? new Date() : assignment.emailSentAt,
        emailTo: input.to || null,
        emailCc: input.cc || null,
        emailError: result.success ? null : result.error || "Email was not sent.",
      },
    });
  }
  return result;
}

export async function sendAssetLoanWorkflowEmail(prisma: PrismaClient, loanId: string, kind: "checkout" | "return", recipientOverride?: string | null): Promise<WorkflowEmailResult> {
  const loan = await prisma.assetLoan.findUnique({ where: { id: loanId }, include: { employee: true, temporaryBorrower: true, items: { include: { device: true } } } });
  if (!loan) return skipped("Asset loan not found.");
  const config = getMailConfig();
  const to = recipientOverride || loan.employee?.email || loan.temporaryBorrower?.email;
  const cc = workflowCc("loan", config);
  const input = kind === "return" ? buildAssetLoanReturnEmail(loan, to, cc, config) : buildAssetLoanCheckoutEmail(loan, to, cc, config);
  const type: EmailLogType = kind === "return" ? "ASSET_LOAN_RETURN" : "ASSET_LOAN_CHECKOUT";
  return sendAndLogEmail(prisma, type, input, { assetLoanId: loan.id, relatedDeviceId: loan.items[0]?.deviceId ?? null }, config);
}

export async function sendStockIssueWorkflowEmail(prisma: PrismaClient, issueId: string, kind: "issue" | "return", recipientOverride?: string | null): Promise<WorkflowEmailResult> {
  const issue = await prisma.stockIssue.findUnique({ where: { id: issueId }, include: { stockItem: true, employee: true, temporaryBorrower: true } });
  if (!issue) return skipped("Stock issue not found.");
  const config = getMailConfig();
  const to = recipientOverride || issue.employee?.email || issue.temporaryBorrower?.email;
  const cc = workflowCc("stock", config);
  const input = kind === "return" ? buildStockReturnEmail(issue, to, cc, config) : buildStockIssueEmail(issue, to, cc, config);
  const type: EmailLogType = kind === "return" ? "STOCK_LOAN_RETURN" : issue.issueType === "HANDOUT" ? "STOCK_ISSUE_HANDOUT" : "STOCK_LOAN_CHECKOUT";
  return sendAndLogEmail(prisma, type, input, { stockIssueId: issue.id }, config);
}

export async function sendRmaWorkflowEmail(prisma: PrismaClient, rmaCaseId: string, kind: "sent" | "follow_up" | "closed", recipientOverride?: string | null): Promise<WorkflowEmailResult> {
  const rma = await prisma.rmaCase.findUnique({ where: { id: rmaCaseId }, include: { items: { include: { device: true } } } });
  if (!rma) return skipped("RMA case not found.");
  const config = getMailConfig();
  const to = recipientOverride || rma.contactEmail;
  const cc = workflowCc("rma", config);
  const input = rmaTemplate(kind, rma, to, cc, config);
  const type: EmailLogType = kind === "closed" ? "RMA_CLOSED" : kind === "follow_up" ? "RMA_FOLLOW_UP" : "RMA_SENT";
  return sendAndLogEmail(prisma, type, input, { rmaCaseId: rma.id, relatedDeviceId: rma.items[0]?.deviceId ?? null }, config);
}

export async function sendTestEmail(prisma: PrismaClient, recipient?: string | null): Promise<WorkflowEmailResult> {
  const config = getMailConfig();
  const input: MailSendInput = {
    to: recipient,
    cc: undefined,
    subject: "Warehouse IT Inventory test email",
    text: "This is a test email from Warehouse IT Inventory. If you received it, SMTP is working.",
    html: "<p>This is a test email from Warehouse IT Inventory. If you received it, SMTP is working.</p>",
  };
  return sendAndLogEmail(prisma, "TEST_EMAIL", input, {}, config);
}

function rmaTemplate(kind: "sent" | "follow_up" | "closed", rma: Parameters<typeof buildRmaSentEmail>[0], to?: string | null, cc?: string | null, config = getMailConfig()) {
  if (kind === "closed") return buildRmaClosedEmail(rma, to, cc, config);
  if (kind === "follow_up") return buildRmaFollowUpEmail(rma, to, cc, config);
  return buildRmaSentEmail(rma, to, cc, config);
}

function skipped(error: string): WorkflowEmailResult {
  return { success: false, skipped: true, error };
}
