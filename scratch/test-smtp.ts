import nodemailer from "nodemailer";
import { config } from "dotenv";
import path from "path";

// Load environment variables from .env
config({ path: path.resolve(process.cwd(), ".env") });

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1";
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || process.env.MAIL_FROM;
const appBaseUrl = process.env.APP_BASE_URL || "https://warehouse-it.local";

async function run() {
  console.log("-----------------------------------------");
  console.log("Warehouse IT Inventory - SMTP Test Utility");
  console.log("-----------------------------------------");

  // Parse recipient and mode from CLI args
  const toArgIdx = process.argv.indexOf("--to");
  let recipient = "";
  if (toArgIdx !== -1 && process.argv[toArgIdx + 1]) {
    recipient = process.argv[toArgIdx + 1];
  }

  const useEthereal = process.argv.includes("--ethereal") || !smtpHost || smtpHost.includes("gmail.com");

  if (!recipient) {
    console.error("ERROR: Recipient is missing. Run this script with: ");
    console.log("  npx tsx scratch/test-smtp.ts --to your-email@domain.com");
    console.log("Options:");
    console.log("  --ethereal   Use a free, auto-generated Ethereal.email test account (Recommended)");
    process.exit(1);
  }

  try {
    let transporter;
    let fromAddress = smtpFrom || "test-sender@ethereal.email";

    if (useEthereal) {
      console.log("Mode: Ethereal Mail (Auto-generated Test Account)");
      console.log("Generating temporary credentials...");
      const testAccount = await nodemailer.createTestAccount();
      console.log(`Generated User: ${testAccount.user}`);
      
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      fromAddress = `test-sender@ethereal.email`;
    } else {
      console.log("Mode: Local .env SMTP Configuration");
      console.log(`SMTP_HOST: ${smtpHost}`);
      console.log(`SMTP_PORT: ${smtpPort}`);
      console.log(`SMTP_FROM: ${fromAddress}`);

      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
      });
    }

    console.log("Verifying connection to SMTP server...");
    await transporter.verify();
    console.log("Connection verified successfully!");

    console.log("Sending mail message...");
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject: "Warehouse IT Inventory - SMTP Verification",
      text: `Hello,\n\nSMTP setup is active!\n\nAccess the inventory platform at: ${appBaseUrl}\n\nBest regards,\nIT System.`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;border:1px solid #e2e8f0;padding:24px;border-radius:8px;">
          <h2 style="color:#0f172a;margin-top:0;">SMTP Verification Success</h2>
          <p style="color:#334155;line-height:1.6;">The SMTP configuration is validated and active on the workstation.</p>
          <div style="margin:24px 0;">
            <a href="${appBaseUrl}" style="background:#0284c7;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block;">Open IT Inventory Platform</a>
          </div>
          <p style="color:#64748b;font-size:14px;margin-bottom:0;">Recipient validation: ${recipient}</p>
        </div>
      `,
    });

    console.log("-----------------------------------------");
    console.log("SUCCESS! Test email sent successfully.");
    console.log(`Message ID: ${info.messageId}`);
    
    if (useEthereal) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log("-----------------------------------------");
      console.log("INBOX PREVIEW LINK (Copy and open in your browser):");
      console.log(previewUrl);
      console.log("-----------------------------------------");
    }
    console.log("-----------------------------------------");
  } catch (error) {
    console.error("-----------------------------------------");
    console.error("ERROR: Failed to connect or send test email.");
    console.error(error instanceof Error ? error.message : error);
    console.error("-----------------------------------------");
    process.exit(1);
  }
}

run();
