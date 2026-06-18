import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ClientInputError, handleApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { sendTestEmail } from "@/lib/email-workflows";
import { prisma } from "@/lib/prisma";

const schema = z.object({ recipient: z.email("Enter a valid recipient email.") });

export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json().catch(() => {
      throw new ClientInputError("Request body must be valid JSON.", 400);
    });
    const data = schema.parse(body);
    const result = await sendTestEmail(prisma, data.recipient);
    return NextResponse.json(result, { status: result.success ? 200 : result.skipped ? 422 : 500 });
  } catch (error) {
    return handleApiError(error);
  }
}
