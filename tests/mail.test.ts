import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { buildAssetLoanCheckoutEmail, buildAssignmentReceiptEmail, buildRmaSentEmail } from "@/lib/email-templates";
import { getMailConfig, getSanitizedMailStatus, logEmailAttempt, sendMailSafely } from "@/lib/mail";

describe("email notifications", () => {
  it("validates SMTP configuration without exposing secrets", () => {
    const missing = getMailConfig({});
    expect(missing.configured).toBe(false);
    expect(missing.missing).toEqual(["SMTP_HOST", "SMTP_FROM or MAIL_FROM"]);

    const configured = getMailConfig({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
      SMTP_USER: "user",
      SMTP_PASS: "secret",
      SMTP_FROM: "it@example.com",
      APP_BASE_URL: "https://inventory.example.com",
    });
    expect(configured.configured).toBe(true);
    expect(configured.secure).toBe(true);
    expect(configured.port).toBe(465);
    expect(configured.pass).toBe("secret");
    expect(getMailConfig({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "preferred@example.com", MAIL_FROM: "fallback@example.com" }).from).toBe("preferred@example.com");
    expect(getMailConfig({ SMTP_HOST: "smtp.example.com", MAIL_FROM: "fallback@example.com" }).from).toBe("fallback@example.com");
  });

  it("returns a sanitized SMTP status without SMTP credentials", () => {
    const status = getSanitizedMailStatus({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "smtp-user",
      SMTP_PASS: "super-secret",
      SMTP_FROM: "it@example.com",
      APP_BASE_URL: "http://192.168.0.67:3000",
    });

    expect(status).toMatchObject({
      configured: true,
      hostPresent: true,
      fromPresent: true,
      portPresent: true,
      port: 587,
      secure: false,
      authPresent: true,
      authPartial: false,
      appBaseUrlPresent: true,
      appBaseUrlLocalhost: false,
    });
    expect(JSON.stringify(status)).not.toContain("super-secret");
    expect(JSON.stringify(status)).not.toContain("smtp-user");
    expect(JSON.stringify(status)).not.toContain("it@example.com");
  });

  it("flags partial SMTP auth safely", () => {
    expect(getSanitizedMailStatus({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "it@example.com", SMTP_USER: "user" })).toMatchObject({ authPresent: false, authPartial: true });
  });

  it("returns a skipped result when SMTP is not configured", async () => {
    const result = await sendMailSafely(
      { to: "user@example.com", subject: "Test", text: "Test", html: "<p>Test</p>" },
      getMailConfig({}),
    );
    expect(result).toMatchObject({ success: false, skipped: true });
    expect(result.error).toContain("Email not configured");
  });

  it("returns a clear skipped result when recipient is missing", async () => {
    const result = await sendMailSafely(
      { to: "", subject: "Test", text: "Test", html: "<p>Test</p>" },
      getMailConfig({ SMTP_HOST: "smtp.example.com", MAIL_FROM: "it@example.com" }),
    );
    expect(result).toMatchObject({ success: false, skipped: true, error: "Recipient email is missing." });
  });

  it("generates and escapes an assignment receipt body", () => {
    const email = buildAssignmentReceiptEmail(
      {
        id: "assignment-1",
        assignmentNumber: "ASN-1",
        assignmentDate: new Date("2026-05-30T08:00:00Z"),
        termsText: "<script>alert(1)</script>",
        notes: "Use carefully",
        employee: { fullName: "Jane User", email: "jane@example.com" },
        items: [{ assignedCondition: "GOOD", asset: { id: "asset-1", name: "Laptop <One>", assetTag: "A-1", serialNumber: "S-1", model: "T14" } }],
      },
      "jane@example.com",
      undefined,
      getMailConfig({ APP_BASE_URL: "https://inventory.example.com" }),
    );
    expect(email.subject).toBe("Assignment receipt ASN-1");
    expect(email.text).toContain("Jane User");
    expect(email.text).toContain("https://inventory.example.com/assignments/assignment-1");
    expect(email.html).toContain('href="https://inventory.example.com/assignments/assignment-1"');
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).not.toContain("<script>alert(1)</script>");
  });

  it("generates an asset loan checkout body", () => {
    const email = buildAssetLoanCheckoutEmail(
      {
        id: "loan-1",
        loanNumber: "LOAN-1",
        loanStartAt: new Date("2026-05-30T08:00:00Z"),
        expectedReturnAt: new Date("2026-06-01T08:00:00Z"),
        employee: { fullName: "Jane User", email: "jane@example.com" },
        temporaryBorrower: null,
        items: [{ conditionOut: "GOOD", device: { id: "asset-1", name: "Scanner", assetTag: "SC-1", serialNumber: "SN-1", model: "Zebra" } }],
      },
      "jane@example.com",
      "it@example.com",
    );
    expect(email.subject).toBe("Asset loan checkout LOAN-1");
    expect(email.text).toContain("Expected return");
    expect(email.text).toContain("SC-1");
  });

  it("generates an RMA sent email body", () => {
    const email = buildRmaSentEmail(
      {
        id: "rma-1",
        rmaNumber: "14",
        destination: "USA",
        vendorName: "Repair Vendor",
        contactEmail: "vendor@example.com",
        carrier: "UPS",
        trackingNumber: "1Z",
        sentAt: new Date("2026-05-30T08:00:00Z"),
        expectedFollowUpAt: new Date("2026-06-06T08:00:00Z"),
        status: "SENT",
        items: [{ result: "PENDING", issueDescription: "Screen issue", device: { id: "asset-1", name: "iPod", assetTag: "IP-1", serialNumber: "SN-1", model: "iPod" } }],
      },
      "vendor@example.com",
      "it@example.com",
    );
    expect(email.subject).toBe("RMA sent 14");
    expect(email.text).toContain("Device count: 1");
    expect(email.text).toContain("IP-1");
  });

  it("creates EmailLog data for skipped attempts", async () => {
    const calls: unknown[] = [];
    const prisma = {
      emailLog: {
        create: async (input: unknown) => {
          calls.push(input);
          return { id: "email-log-1" };
        },
      },
    } as unknown as PrismaClient;
    const log = await logEmailAttempt(
      prisma,
      "TEST_EMAIL",
      { to: "", subject: "Test", text: "Test", html: "<p>Test</p>" },
      { success: false, skipped: true, error: "Recipient email is missing." },
    );
    expect(log.id).toBe("email-log-1");
    expect(calls[0]).toMatchObject({ data: { recipient: "missing recipient", status: "SKIPPED", errorMessage: "Recipient email is missing." } });
  });

  it("keeps email send routes behind server-side permissions", async () => {
    const projectRoot = process.cwd();
    const testEmailRoute = await fs.readFile(path.join(projectRoot, "app", "api", "email", "test", "route.ts"), "utf8");
    const assignmentRoute = await fs.readFile(path.join(projectRoot, "app", "api", "assignments", "[id]", "email", "route.ts"), "utf8");
    const loanRoute = await fs.readFile(path.join(projectRoot, "app", "api", "loans", "[id]", "email", "route.ts"), "utf8");
    const stockRoute = await fs.readFile(path.join(projectRoot, "app", "api", "stock", "issues", "[id]", "email", "route.ts"), "utf8");
    const rmaRoute = await fs.readFile(path.join(projectRoot, "app", "api", "rma", "[id]", "email", "route.ts"), "utf8");

    expect(testEmailRoute).toContain('requireRole("ADMIN")');
    expect(assignmentRoute).toContain('requirePermission("assignments.write")');
    expect(loanRoute).toContain('requirePermission("loans.write")');
    expect(stockRoute).toContain('requirePermission("stock.write")');
    expect(rmaRoute).toContain('requirePermission("rma.write")');
  });

  it("keeps the test email route friendly for malformed JSON", async () => {
    const projectRoot = process.cwd();
    const testEmailRoute = await fs.readFile(path.join(projectRoot, "app", "api", "email", "test", "route.ts"), "utf8");

    expect(testEmailRoute).toContain("Request body must be valid JSON.");
    expect(testEmailRoute).toContain("ClientInputError");
  });

  it("keeps BitLocker and recovery-key data out of email template code", async () => {
    const projectRoot = process.cwd();
    const templateSource = await fs.readFile(path.join(projectRoot, "lib", "email-templates.ts"), "utf8");

    expect(templateSource).not.toMatch(/bitlocker/i);
    expect(templateSource).not.toMatch(/recovery\s*key/i);
    expect(templateSource).not.toMatch(/vault/i);
  });
});
