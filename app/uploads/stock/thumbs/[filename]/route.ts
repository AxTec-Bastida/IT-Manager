import { prisma } from "@/lib/prisma";
import { isSafeUploadFilename, readUploadFile, uploadContentDisposition } from "@/lib/uploads";

export const runtime = "nodejs";

type Context = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, context: Context) {
  const { filename } = await context.params;
  if (!isSafeUploadFilename(filename)) return new Response("Not found", { status: 404 });
  const photo = await prisma.stockItemPhoto.findFirst({ where: { thumbnailFilename: filename } });
  if (!photo) return new Response("Not found", { status: 404 });
  const bytes = await readUploadFile("stock", filename, "thumbs");
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes, {
    headers: {
      "content-type": "image/jpeg",
      "content-disposition": uploadContentDisposition(photo.originalFilename, filename),
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
