import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSafeUploadFilename, readUploadFile, uploadContentDisposition, uploadContentType } from "@/lib/uploads";

export const runtime = "nodejs";

type Context = { params: Promise<{ filename: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { filename } = await context.params;
  if (!isSafeUploadFilename(filename)) return new NextResponse("Not found", { status: 404 });

  const map = await prisma.warehouseMap.findFirst({ where: { uploadedStoredFilename: filename } });
  if (!map) return new NextResponse("Not found", { status: 404 });

  const bytes = await readUploadFile("maps", filename);
  if (!bytes) return new NextResponse("Not found", { status: 404 });

  const contentType = uploadContentType(map.uploadedMimeType, filename, "maps");
  if (!contentType) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(bytes, {
    headers: {
      "content-type": contentType,
      "content-disposition": uploadContentDisposition(map.uploadedOriginalFilename, filename),
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
