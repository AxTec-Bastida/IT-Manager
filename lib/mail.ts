import nodemailer from "nodemailer";
import type { EmailLogType, Prisma, PrismaClient } from "@prisma/client";

export type MailConfig = {
  configured: boolean;
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from?: string;
  replyTo?: string;
  appBaseUrl?: string;
  defaultCc?: string;
  workflowCc: {
    assignment?: string;
    loan?: string;
    rma?: string;
    stock?: string;
  };
  missing: string[];
};

export type SanitizedMailStatus = {
  configured: boolean;
  hostPresent: boolean;
  fromPresent: boolean;
  portPresent: boolean;
  port: number;
  secure: boolean;
  authPresent: boolean;
  authPartial: boolean;
  appBaseUrlPresent: boolean;
  appBaseUrlLocalhost: boolean;
  missing: string[];
};

export type MailSendInput = {
  to?: string | null;
  cc?: string | null;
  subject: string;
  text: string;
  html: string;
  replyTo?: string | null;
};

export type MailSendResult = {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
};

export type EmailLogRelations = {
  relatedDeviceId?: string | null;
  assignmentId?: string | null;
  assetLoanId?: string | null;
  stockIssueId?: string | null;
  rmaCaseId?: string | null;
  alertId?: string | null;
};

export function getMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  const host = clean(env.SMTP_HOST);
  const from = clean(env.SMTP_FROM) || clean(env.MAIL_FROM);
  const port = Number(clean(env.SMTP_PORT) || 587);
  const missing = [];
  if (!host) missing.push("SMTP_HOST");
  if (!from) missing.push("SMTP_FROM or MAIL_FROM");
  return {
    configured: missing.length === 0,
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: parseBoolean(env.SMTP_SECURE),
    user: clean(env.SMTP_USER),
    pass: clean(env.SMTP_PASS),
    from,
    replyTo: clean(env.MAIL_REPLY_TO),
    appBaseUrl: clean(env.APP_BASE_URL),
    defaultCc: clean(env.IT_NOTIFICATION_CC),
    workflowCc: {
      assignment: clean(env.IT_ASSIGNMENT_CC),
      loan: clean(env.IT_LOAN_CC),
      rma: clean(env.IT_RMA_CC),
      stock: clean(env.IT_STOCK_CC),
    },
    missing,
  };
}

export function getSanitizedMailStatus(env: NodeJS.ProcessEnv = process.env): SanitizedMailStatus {
  const config = getMailConfig(env);
  const userPresent = Boolean(clean(env.SMTP_USER));
  const passPresent = Boolean(clean(env.SMTP_PASS));
  const appBaseUrl = clean(env.APP_BASE_URL);
  let appBaseUrlLocalhost = false;
  if (appBaseUrl) {
    try {
      const host = new URL(appBaseUrl).hostname.toLowerCase();
      appBaseUrlLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    } catch {
      appBaseUrlLocalhost = false;
    }
  }

  return {
    configured: config.configured,
    hostPresent: Boolean(config.host),
    fromPresent: Boolean(config.from),
    portPresent: Boolean(clean(env.SMTP_PORT)),
    port: config.port,
    secure: config.secure,
    authPresent: userPresent && passPresent,
    authPartial: (userPresent || passPresent) && !(userPresent && passPresent),
    appBaseUrlPresent: Boolean(appBaseUrl),
    appBaseUrlLocalhost,
    missing: config.missing,
  };
}

export async function sendMailSafely(input: MailSendInput, config = getMailConfig()): Promise<MailSendResult> {
  if (!input.to?.trim()) return { success: false, skipped: true, error: "Recipient email is missing." };
  if (!config.configured) return { success: false, skipped: true, error: `Email not configured. Missing ${config.missing.join(", ")}.` };

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
    const info = await transporter.sendMail({
      from: config.from,
      to: input.to,
      cc: input.cc || undefined,
      replyTo: input.replyTo || config.replyTo || undefined,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: sanitizeMailError(error) };
  }
}

export async function logEmailAttempt(
  prisma: PrismaClient,
  type: EmailLogType,
  input: MailSendInput,
  result: MailSendResult,
  relations: EmailLogRelations = {},
) {
  return prisma.emailLog.create({
    data: {
      type,
      recipient: input.to?.trim() || "missing recipient",
      cc: input.cc?.trim() || null,
      subject: input.subject,
      status: result.success ? "SENT" : result.skipped ? "SKIPPED" : "FAILED",
      errorMessage: result.error ?? null,
      messageId: result.messageId ?? null,
      ...relations,
    } satisfies Prisma.EmailLogUncheckedCreateInput,
  });
}

export async function sendAndLogEmail(
  prisma: PrismaClient,
  type: EmailLogType,
  input: MailSendInput,
  relations: EmailLogRelations = {},
  config = getMailConfig(),
) {
  const result = await sendMailSafely(input, config);
  const log = await logEmailAttempt(prisma, type, input, result, relations);
  return { ...result, logId: log.id };
}

export function workflowCc(workflow: keyof MailConfig["workflowCc"], config = getMailConfig()) {
  return config.workflowCc[workflow] || config.defaultCc || undefined;
}

export function getAppBaseUrl(config = getMailConfig()) {
  return (config.appBaseUrl || "http://localhost:3000").replace(/\/+$/, "");
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function textLine(label: string, value: unknown) {
  const normalized = value == null || value === "" ? "-" : String(value);
  return `${label}: ${normalized}`;
}

export function htmlTable(rows: Array<[string, unknown]>) {
  return `<table style="border-collapse:collapse;width:100%;max-width:760px">${rows
    .map(([label, value]) => `<tr><th style="text-align:left;border:1px solid #e2e8f0;padding:8px;background:#f8fafc">${escapeHtml(label)}</th><td style="border:1px solid #e2e8f0;padding:8px">${escapeHtml(value || "-")}</td></tr>`)
    .join("")}</table>`;
}

export function htmlList(items: string[]) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function clean(value?: string) {
  return value?.trim() || undefined;
}

function parseBoolean(value?: string) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function sanitizeMailError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "EAUTH") return "SMTP authentication failed. Check SMTP_USER, SMTP_PASS, port, and secure mode.";
  if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ESOCKET") return "SMTP connection failed. Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, firewall, and network access.";
  if (code === "EENVELOPE") return "Email envelope was rejected. Check recipient and sender addresses.";
  return "Email send failed. Check SMTP settings and server logs.";
}
