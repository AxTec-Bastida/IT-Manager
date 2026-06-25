import { NextResponse } from "next/server";
import { sendMailSafely } from "@/lib/mail";
import { hasPageRole } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await hasPageRole("ADMIN"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { to } = body;

    if (!to || !to.includes("@")) {
      return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
    }

    const result = await sendMailSafely({
      to,
      subject: "Warehouse IT - SMTP Test Email",
      text: "This is a test email sent from the Warehouse IT Inventory system to verify that your SMTP credentials and host configurations are working correctly.",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #0f172a; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 600px; margin: auto;">
          <h2 style="color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 8px;">Warehouse IT Connection Test</h2>
          <p>This is a test email sent from the Warehouse IT Inventory system to verify that your SMTP credentials and host configurations are working correctly.</p>
          <p style="margin-top: 20px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px;">
            System Base URL: ${process.env.APP_BASE_URL || "http://localhost:3000"}
          </p>
        </div>
      `,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Mail sending failed." }, { status: 400 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch {
    return NextResponse.json({ error: "Failed to send test email." }, { status: 500 });
  }
}
