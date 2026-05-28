import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const status = search.get("status") || undefined;
  const severity = search.get("severity") || undefined;
  const type = search.get("type") || undefined;
  const source = search.get("source") || undefined;
  const assetId = search.get("assetId") || undefined;
  const alerts = await prisma.alert.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(severity ? { severity: severity as never } : {}),
      ...(type ? { type: type as never } : {}),
      ...(source ? { source: source as never } : {}),
      ...(assetId ? { assetId } : {}),
    },
    include: { asset: true, stockItem: true },
    orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
    take: 100,
  });
  return NextResponse.json({ alerts });
}
