import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { sendRmaWorkflowEmail } from "@/lib/email-workflows";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  kind: z.enum(["sent", "follow_up", "closed"]).default("sent"),
  recipient: z.string().trim().optional().nullable().transform((value) => value || null).refine((value) => !value || z.email().safeParse(value).success, "Enter a valid recipient email."),
});

export async function POST(request: NextRequest, context: Context) {
  try {
    await requirePermission("rma.write");
    const { id } = await context.params;
    const data = schema.parse(await request.json());
    const result = await sendRmaWorkflowEmail(prisma, id, data.kind, data.recipient);
    return NextResponse.json(result, { status: result.success ? 200 : result.skipped ? 422 : 500 });
  } catch (error) {
    return handleApiError(error);
  }
}
