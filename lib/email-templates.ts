import type { AssetLoanReturnCondition, DeviceCondition, RmaCaseStatus, RmaItemResult, StockIssueType, StockReturnCondition } from "@prisma/client";
import { escapeHtml, getAppBaseUrl, htmlList, htmlTable, textLine, type MailConfig, type MailSendInput } from "./mail";

type DeviceSummary = {
  id: string;
  name: string;
  assetTag?: string | null;
  serialNumber?: string | null;
  model?: string | null;
  photos?: Array<{ filePath: string; thumbnailPath?: string | null; caption?: string | null }> | null;
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
  signatureData?: string | null;
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
  signatureData?: string | null;
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
  const mailInput = compose({
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
  return enrichAssignmentEmail(mailInput, assignment, config);
}

export function buildAssignmentReturnEmail(assignment: AssignmentEmailData, to: string | null | undefined, cc?: string | null, config?: MailConfig): MailSendInput {
  const link = `${getAppBaseUrl(config)}/assignments/${assignment.id}`;
  const returned = assignment.items.filter((item) => item.returnedAt || item.returnedCondition || item.returnNotes);
  const responsible = assignmentResponsibility(assignment);
  const mailInput = compose({
    to,
    cc,
    subject: `Assignment return confirmation ${assignment.assignmentNumber}`,
    title: `Assignment return confirmation ${assignment.assignmentNumber}`,
    rows: [["Responsibility target", responsible], ["Assignment link", link]],
    bullets: returned.map((item) => `${item.asset.name} / ${item.asset.assetTag || "No tag"} / Return condition: ${item.returnedCondition || "-"} / Returned: ${formatDateTime(item.returnedAt)} / Notes: ${item.returnNotes || "-"}`),
    link,
  });
  return enrichAssignmentEmail(mailInput, assignment, config);
}

function assignmentResponsibility(assignment: AssignmentEmailData) {
  return assignment.targetPath || assignment.targetName || assignment.employee?.fullName || "Unassigned responsibility target";
}

export function buildAssetLoanCheckoutEmail(loan: AssetLoanEmailData, to: string | null | undefined, cc?: string | null, config?: MailConfig): MailSendInput {
  const borrower = assetLoanBorrower(loan);
  const link = `${getAppBaseUrl(config)}/loans/${loan.id}`;
  const mailInput = compose({
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
  return enrichAssetLoanEmail(mailInput, loan, config);
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

export function buildAssetLoanOverdueEmail(loan: AssetLoanEmailData, to: string | null | undefined, cc?: string | null, config?: MailConfig): MailSendInput {
  const borrower = assetLoanBorrower(loan);
  const link = `${getAppBaseUrl(config)}/loans/${loan.id}`;
  const isOverdue = new Date(loan.expectedReturnAt).getTime() < new Date().setHours(0, 0, 0, 0);
  const subjectPrefix = isOverdue ? "OVERDUE REMINDER" : "DUE DATE REMINDER";
  return compose({
    to,
    cc,
    subject: `${subjectPrefix}: Asset loan ${loan.loanNumber}`,
    title: `${subjectPrefix}: Asset loan ${loan.loanNumber}`,
    rows: [
      ["Borrower", borrower],
      ["Borrower type", loan.employee ? "Employee" : "Temporary borrower"],
      ["Loan start", formatDateTime(loan.loanStartAt)],
      ["Expected return", formatDateTime(loan.expectedReturnAt)],
      ["Status", isOverdue ? "OVERDUE" : "DUE TODAY"],
      ["Loan link", link],
      ["Notes", loan.checkoutNotes || "-"],
    ],
    bullets: loan.items.map((item) => `${item.device.name} / ${item.device.assetTag || "No tag"} / ${item.device.serialNumber || "No serial"} / Condition out: ${item.conditionOut || "-"}`),
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

function enrichAssignmentEmail(
  mailInput: MailSendInput,
  assignment: AssignmentEmailData,
  config?: MailConfig
): MailSendInput {
  const baseUrl = getAppBaseUrl(config);

  const getAbsoluteUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  };

  // 1. Gather all photos
  const allPhotos = assignment.items.flatMap((item) =>
    (item.asset.photos || []).map((photo) => ({
      photo,
      assetName: item.asset.name,
      tag: item.asset.assetTag,
    }))
  );

  let photosHtml = "";
  let photosText = "";
  if (allPhotos.length > 0) {
    photosText = "\nEquipment Photos:\n" + allPhotos.map(({ photo, assetName, tag }) => {
      const label = [assetName, tag ? `(${tag})` : null, photo.caption].filter(Boolean).join(" - ");
      const url = getAbsoluteUrl(photo.filePath);
      return `- ${label}: ${url}`;
    }).join("\n") + "\n";

    photosHtml = `
<h2 style="font-size:16px;margin-top:18px">Equipment Photos</h2>
<div style="margin-top:8px">
  ${allPhotos
    .map(({ photo, assetName, tag }) => {
      const imgSrc = getAbsoluteUrl(photo.thumbnailPath || photo.filePath);
      const label = [assetName, tag ? `(${tag})` : null, photo.caption].filter(Boolean).join(" - ");
      const safeImgSrc = escapeHtml(imgSrc);
      const safeLabel = escapeHtml(label);
      return `
        <div style="display:inline-block;margin-right:12px;margin-bottom:12px;vertical-align:top;width:150px;font-family:Arial,sans-serif">
          <div style="width:150px;height:112px;overflow:hidden;border:1px solid #cbd5e1;border-radius:6px;background-color:#f1f5f9">
            <img src="${safeImgSrc}" alt="${safeLabel}" style="width:150px;height:112px;object-fit:cover" />
          </div>
          <p style="font-size:11px;color:#475569;margin-top:4px;margin-bottom:0;line-height:1.2;word-break:break-word">${safeLabel}</p>
        </div>
      `;
    })
    .join("")}
</div>
`;
  }

  // 2. Signature
  let signatureHtml = "";
  let signatureText = "";
  const safeSignatureData = safeInlineSignatureData(assignment.signatureData);
  if (safeSignatureData) {
    signatureText = "\nSignature captured and stored on record.\n";
    signatureHtml = `
<h2 style="font-size:16px;margin-top:18px">Signature</h2>
<img src="${escapeHtml(safeSignatureData)}" alt="Signature" style="max-width:300px;border:1px solid #cbd5e1;border-radius:6px;background-color:#ffffff;display:block;margin-top:8px" />
`;
  }

  // Append to plain text
  let newText = mailInput.text;
  if (photosText || signatureText) {
    newText = mailInput.text.replace(
      /(\nOpen:)/,
      () => `${photosText}${signatureText}\nOpen:`
    );
  }

  // Append to HTML right before the Open record link
  let newHtml = mailInput.html;
  const targetTag = `<p style="margin-top:18px">`;
  if (newHtml.includes(targetTag)) {
    newHtml = newHtml.replace(
      targetTag,
      () => `${photosHtml}${signatureHtml}${targetTag}`
    );
  } else {
    newHtml = newHtml.replace(
      /<\/div>$/,
      () => `${photosHtml}${signatureHtml}</div>`
    );
  }

  return {
    ...mailInput,
    text: newText,
    html: newHtml,
  };
}

function enrichAssetLoanEmail(
  mailInput: MailSendInput,
  loan: AssetLoanEmailData,
  config?: MailConfig
): MailSendInput {
  const baseUrl = getAppBaseUrl(config);

  const getAbsoluteUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  };

  // 1. Gather all photos
  const allPhotos = loan.items.flatMap((item) =>
    (item.device.photos || []).map((photo) => ({
      photo,
      deviceName: item.device.name,
      tag: item.device.assetTag,
    }))
  );

  let photosHtml = "";
  let photosText = "";
  if (allPhotos.length > 0) {
    photosText = "\nEquipment Photos:\n" + allPhotos.map(({ photo, deviceName, tag }) => {
      const label = [deviceName, tag ? `(${tag})` : null, photo.caption].filter(Boolean).join(" - ");
      const url = getAbsoluteUrl(photo.filePath);
      return `- ${label}: ${url}`;
    }).join("\n") + "\n";

    photosHtml = `
<h2 style="font-size:16px;margin-top:18px">Equipment Photos</h2>
<div style="margin-top:8px">
  ${allPhotos
    .map(({ photo, deviceName, tag }) => {
      const imgSrc = getAbsoluteUrl(photo.thumbnailPath || photo.filePath);
      const label = [deviceName, tag ? `(${tag})` : null, photo.caption].filter(Boolean).join(" - ");
      const safeImgSrc = escapeHtml(imgSrc);
      const safeLabel = escapeHtml(label);
      return `
        <div style="display:inline-block;margin-right:12px;margin-bottom:12px;vertical-align:top;width:150px;font-family:Arial,sans-serif">
          <div style="width:150px;height:112px;overflow:hidden;border:1px solid #cbd5e1;border-radius:6px;background-color:#f1f5f9">
            <img src="${safeImgSrc}" alt="${safeLabel}" style="width:150px;height:112px;object-fit:cover" />
          </div>
          <p style="font-size:11px;color:#475569;margin-top:4px;margin-bottom:0;line-height:1.2;word-break:break-word">${safeLabel}</p>
        </div>
      `;
    })
    .join("")}
</div>
`;
  }

  // 2. Signature
  let signatureHtml = "";
  let signatureText = "";
  const safeSignatureData = safeInlineSignatureData(loan.signatureData);
  if (safeSignatureData) {
    signatureText = "\nSignature captured and stored on record.\n";
    signatureHtml = `
<h2 style="font-size:16px;margin-top:18px">Signature</h2>
<img src="${escapeHtml(safeSignatureData)}" alt="Signature" style="max-width:300px;border:1px solid #cbd5e1;border-radius:6px;background-color:#ffffff;display:block;margin-top:8px" />
`;
  }

  // Append to plain text
  let newText = mailInput.text;
  if (photosText || signatureText) {
    newText = mailInput.text.replace(
      /(\nOpen:)/,
      () => `${photosText}${signatureText}\nOpen:`
    );
  }

  // Append to HTML right before the Open record link
  let newHtml = mailInput.html;
  const targetTag = `<p style="margin-top:18px">`;
  if (newHtml.includes(targetTag)) {
    newHtml = newHtml.replace(
      targetTag,
      () => `${photosHtml}${signatureHtml}${targetTag}`
    );
  } else {
    newHtml = newHtml.replace(
      /<\/div>$/,
      () => `${photosHtml}${signatureHtml}</div>`
    );
  }

  return {
    ...mailInput,
    text: newText,
    html: newHtml,
  };
}

function safeInlineSignatureData(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^data:image\/(?:png|jpeg|jpg|webp);base64,[a-z0-9+/=]+$/i.test(trimmed) ? trimmed : null;
}
