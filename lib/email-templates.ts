import type { AssetLoanReturnCondition, DeviceCondition, RmaCaseStatus, RmaItemResult, StockIssueType, StockReturnCondition } from "@prisma/client";
import { getAppBaseUrl, htmlList, htmlTable, textLine, type MailConfig, type MailSendInput } from "./mail";

type DeviceSummary = {
  id: string;
  name: string;
  assetTag?: string | null;
  serialNumber?: string | null;
  model?: string | null;
};

export type AssignmentEmailData = {
  id: string;
  assignmentNumber: string;
  assignmentDate: Date;
  termsText?: string | null;
  notes?: string | null;
  targetName?: string | null;
  targetPath?: string | null;
  targetType?: string | null;
  employee?: { fullName: string; email?: string | null } | null;
  items: Array<{
    assignedCondition?: DeviceCondition | null;
    returnedCondition?: DeviceCondition | null;
    returnedAt?: Date | null;
    returnNotes?: string | null;
    asset: DeviceSummary;
  }>;
};

export type AssetLoanEmailData = {
  id: string;
  loanNumber: string;
  loanStartAt: Date;
  expectedReturnAt: Date;
  actualReturnAt?: Date | null;
  checkoutNotes?: string | null;
  returnNotes?: string | null;
  employee?: { fullName: string; email?: string | null } | null;
  temporaryBorrower?: { name: string; email?: string | null } | null;
  items: Array<{
    conditionOut?: DeviceCondition | null;
    conditionIn?: AssetLoanReturnCondition | null;
    returnedAt?: Date | null;
    returnNotes?: string | null;
    device: DeviceSummary;
  }>;
};

export type StockIssueEmailData = {
  id: string;
  issueNumber?: string | null;
  quantity: number;
  returnedQuantity: number;
  issueType: StockIssueType;
  issuedAt: Date;
  expectedReturnAt?: Date | null;
  returnedAt?: Date | null;
  conditionIn?: StockReturnCondition | null;
  notes?: string | null;
  returnNotes?: string | null;
  stockItem: { name: string; sku?: string | null };
  employee?: { fullName: string; email?: string | null } | null;
  temporaryBorrower?: { name: string; email?: string | null } | null;
};

export type RmaEmailData = {
  id: string;
  rmaNumber: string;
  title?: string | null;
  destination: string;
  vendorName?: string | null;
  contactEmail?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  sentAt?: Date | null;
  expectedFollowUpAt?: Date | null;
  status: RmaCaseStatus;
  notes?: string | null;
  items: Array<{
    issueDescription?: string | null;
    result: RmaItemResult;
    returnedAt?: Date | null;
    device: DeviceSummary;
  }>;
};

export function buildAssignmentReceiptEmail(assignment: AssignmentEmailData, to: string | null | undefined, cc?: string | null, config?: MailConfig): MailSendInput {
  const link = `${getAppBaseUrl(config)}/assignments/${assignment.id}`;
  const assetLines = assignment.items.map((item) => `${item.asset.name} / ${item.asset.assetTag || "No tag"} / ${item.asset.serialNumber || "No serial"} / ${item.asset.model || "No model"} / Condition: ${item.assignedCondition || "-"}`);
  const responsible = assignmentResponsibility(assignment);
  return compose({
    to,
    cc,
    subject: `Assignment receipt ${assignment.assignmentNumber}`,
    title: `Assignment receipt ${assignment.assignmentNumber}`,
    rows: [
      ["Responsibility target", responsible],
      ["Assignment date", formatDateTime(assignment.assignmentDate)],
      ["Assignment link", link],
      ["Responsibility terms", assignment.termsText || "-"],
      ["Notes", assignment.notes || "-"],
    ],
    bullets: assetLines,
    link,
  });
}

export function buildAssignmentReturnEmail(assignment: AssignmentEmailData, to: string | null | undefined, cc?: string | null, config?: MailConfig): MailSendInput {
  const link = `${getAppBaseUrl(config)}/assignments/${assignment.id}`;
  const returned = assignment.items.filter((item) => item.returnedAt || item.returnedCondition || item.returnNotes);
  const responsible = assignmentResponsibility(assignment);
  return compose({
    to,
    cc,
    subject: `Assignment return confirmation ${assignment.assignmentNumber}`,
    title: `Assignment return confirmation ${assignment.assignmentNumber}`,
    rows: [["Responsibility target", responsible], ["Assignment link", link]],
    bullets: returned.map((item) => `${item.asset.name} / ${item.asset.assetTag || "No tag"} / Return condition: ${item.returnedCondition || "-"} / Returned: ${formatDateTime(item.returnedAt)} / Notes: ${item.returnNotes || "-"}`),
    link,
  });
}

function assignmentResponsibility(assignment: AssignmentEmailData) {
  return assignment.targetPath || assignment.targetName || assignment.employee?.fullName || "Unassigned responsibility target";
}

export function buildAssetLoanCheckoutEmail(loan: AssetLoanEmailData, to: string | null | undefined, cc?: string | null, config?: MailConfig): MailSendInput {
  const borrower = assetLoanBorrower(loan);
  const link = `${getAppBaseUrl(config)}/loans/${loan.id}`;
  return compose({
    to,
    cc,
    subject: `Asset loan checkout ${loan.loanNumber}`,
    title: `Asset loan checkout ${loan.loanNumber}`,
    rows: [
      ["Borrower", borrower],
      ["Borrower type", loan.employee ? "Employee" : "Temporary borrower"],
      ["Loan start", formatDateTime(loan.loanStartAt)],
      ["Expected return", formatDateTime(loan.expectedReturnAt)],
      ["Loan link", link],
      ["Notes", loan.checkoutNotes || "-"],
    ],
    bullets: loan.items.map((item) => `${item.device.name} / ${item.device.assetTag || "No tag"} / ${item.device.serialNumber || "No serial"} / Condition out: ${item.conditionOut || "-"}`),
    link,
  });
}

export function buildAssetLoanReturnEmail(loan: AssetLoanEmailData, to: string | null | undefined, cc?: string | null, config?: MailConfig): MailSendInput {
  const link = `${getAppBaseUrl(config)}/loans/${loan.id}`;
  const returned = loan.items.filter((item) => item.returnedAt || item.conditionIn || item.returnNotes);
  return compose({
    to,
    cc,
    subject: `Asset loan return ${loan.loanNumber}`,
    title: `Asset loan return ${loan.loanNumber}`,
    rows: [
      ["Borrower", assetLoanBorrower(loan)],
      ["Actual return", formatDateTime(loan.actualReturnAt)],
      ["Loan link", link],
      ["Return notes", loan.returnNotes || "-"],
    ],
    bullets: returned.map((item) => `${item.device.name} / ${item.device.assetTag || "No tag"} / Return condition: ${item.conditionIn || "-"} / Returned: ${formatDateTime(item.returnedAt)} / Notes: ${item.returnNotes || "-"}`),
    link,
  });
}

export function buildStockIssueEmail(issue: StockIssueEmailData, to: string | null | undefined, cc?: string | null, config?: MailConfig): MailSendInput {
  const link = `${getAppBaseUrl(config)}/stock/issues/${issue.id}`;
  const checkout = issue.issueType === "HANDOUT" ? "Stock handout" : "Stock loan checkout";
  return compose({
    to,
    cc,
    subject: `${checkout} ${issue.issueNumber || issue.stockItem.name}`,
    title: `${checkout} ${issue.issueNumber || issue.stockItem.name}`,
    rows: [
      ["Borrower", stockBorrower(issue)],
      ["Stock item", issue.stockItem.name],
      ["Quantity", issue.quantity],
      ["Issue type", issue.issueType],
      ["Issued date", formatDateTime(issue.issuedAt)],
      ["Expected return", formatDateTime(issue.expectedReturnAt)],
      ["Issue link", link],
      ["Notes", issue.notes || "-"],
    ],
    link,
  });
}

export function buildStockReturnEmail(issue: StockIssueEmailData, to: string | null | undefined, cc?: string | null, config?: MailConfig): MailSendInput {
  const link = `${getAppBaseUrl(config)}/stock/issues/${issue.id}`;
  return compose({
    to,
    cc,
    subject: `Stock loan return ${issue.issueNumber || issue.stockItem.name}`,
    title: `Stock loan return ${issue.issueNumber || issue.stockItem.name}`,
    rows: [
      ["Borrower", stockBorrower(issue)],
      ["Stock item", issue.stockItem.name],
      ["Returned quantity", issue.returnedQuantity],
      ["Return condition", issue.conditionIn || "-"],
      ["Returned at", formatDateTime(issue.returnedAt)],
      ["Issue link", link],
      ["Return notes", issue.returnNotes || "-"],
    ],
    link,
  });
}

export function buildRmaSentEmail(rma: RmaEmailData, to: string | null | undefined, cc?: string | null, config?: MailConfig): MailSendInput {
  const link = `${getAppBaseUrl(config)}/rma/${rma.id}`;
  return compose({
    to,
    cc,
    subject: `RMA sent ${rma.rmaNumber}`,
    title: `RMA sent ${rma.rmaNumber}`,
    rows: rmaRows(rma, link),
    bullets: rma.items.map((item) => `${item.device.assetTag || "No tag"} / ${item.device.serialNumber || "No serial"} / ${item.device.model || "No model"} / Issue: ${item.issueDescription || "-"}`),
    link,
  });
}

export function buildRmaFollowUpEmail(rma: RmaEmailData, to: string | null | undefined, cc?: string | null, config?: MailConfig): MailSendInput {
  const link = `${getAppBaseUrl(config)}/rma/${rma.id}`;
  const pending = rma.items.filter((item) => item.result === "PENDING").length;
  return compose({
    to,
    cc,
    subject: `RMA follow-up ${rma.rmaNumber}`,
    title: `RMA follow-up ${rma.rmaNumber}`,
    rows: [...rmaRows(rma, link), ["Days active", daysActive(rma.sentAt)], ["Pending devices", pending]],
    link,
  });
}

export function buildRmaClosedEmail(rma: RmaEmailData, to: string | null | undefined, cc?: string | null, config?: MailConfig): MailSendInput {
  const link = `${getAppBaseUrl(config)}/rma/${rma.id}`;
  const counts = rma.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.result] = (acc[item.result] || 0) + 1;
    return acc;
  }, {});
  return compose({
    to,
    cc,
    subject: `RMA closed ${rma.rmaNumber}`,
    title: `RMA closed ${rma.rmaNumber}`,
    rows: [
      ...rmaRows(rma, link),
      ["Repaired", counts.REPAIRED || 0],
      ["Replaced", counts.REPLACED || 0],
      ["Rejected", counts.REJECTED || 0],
      ["Lost", counts.LOST || 0],
      ["Retired", counts.RETIRED || 0],
      ["Returned as-is", counts.RETURNED_AS_IS || 0],
    ],
    link,
  });
}

function compose({ to, cc, subject, title, rows, bullets = [], link }: { to?: string | null; cc?: string | null; subject: string; title: string; rows: Array<[string, unknown]>; bullets?: string[]; link: string }): MailSendInput {
  const text = [`${title}`, "", ...rows.map(([label, value]) => textLine(label, value)), bullets.length ? "\nItems:" : "", ...bullets.map((item) => `- ${item}`), "", `Open: ${link}`].filter(Boolean).join("\n");
  const html = `<div style="font-family:Arial,sans-serif;color:#0f172a"><h1 style="font-size:20px">${title}</h1>${htmlTable(rows)}${bullets.length ? `<h2 style="font-size:16px;margin-top:18px">Items</h2>${htmlList(bullets)}` : ""}<p style="margin-top:18px"><a href="${link}">Open record</a></p></div>`;
  return { to, cc, subject, text, html };
}

function formatDateTime(value?: Date | null) {
  return value ? value.toLocaleString() : "-";
}

function assetLoanBorrower(loan: AssetLoanEmailData) {
  return loan.employee?.fullName || loan.temporaryBorrower?.name || "Unknown borrower";
}

function stockBorrower(issue: StockIssueEmailData) {
  return issue.employee?.fullName || issue.temporaryBorrower?.name || "Unknown borrower";
}

function rmaRows(rma: RmaEmailData, link: string): Array<[string, unknown]> {
  return [
    ["RMA number", rma.rmaNumber],
    ["Destination", rma.destination],
    ["Vendor", rma.vendorName || "-"],
    ["Carrier / tracking", [rma.carrier, rma.trackingNumber].filter(Boolean).join(" / ") || "-"],
    ["Sent date", formatDateTime(rma.sentAt)],
    ["Expected follow-up", formatDateTime(rma.expectedFollowUpAt)],
    ["Device count", rma.items.length],
    ["RMA link", link],
    ["Notes", rma.notes || "-"],
  ];
}

function daysActive(sentAt?: Date | null) {
  if (!sentAt) return "-";
  const start = new Date(sentAt);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
}
