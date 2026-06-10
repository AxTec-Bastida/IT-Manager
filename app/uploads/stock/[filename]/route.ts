import { prisma } from "@/lib/prisma";
import { isSafeUploadFilename, readUploadFile, uploadContentDisposition, uploadContentType } from "@/lib/uploads";

export const runtime = "nodejs";

type Context = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, context: Context) {
  const { filename } = await context.params;
  if (!isSafeUploadFilename(filename)) return new Response("Not found", { status: 404 });
  const photo = await prisma.stockItemPhoto.findFirst({ where: { storedFilename: filename } });
  if (!photo) return new Response("Not found", { status: 404 });
  const contentType = uploadContentType(photo.mimeType, filename, "stock");
  if (!contentType) return new Response("Not found", { status: 404 });
  const bytes = await readUploadFile("stock", filename);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes, {
    headers: {
      "content-type": contentType,
      "content-disposition": uploadContentDisposition(photo.originalFilename, filename),
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
