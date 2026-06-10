import { prisma } from "@/lib/prisma";
import { readUploadFile, uploadContentDisposition, uploadContentType, isSafeUploadFilename } from "@/lib/uploads";

export const runtime = "nodejs";

type Context = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, context: Context) {
  const { filename } = await context.params;
  if (!isSafeUploadFilename(filename)) return new Response("Not found", { status: 404 });
  const factura = await prisma.factura.findFirst({ where: { storedFilename: filename } });
  if (!factura?.mimeType) return new Response("Not found", { status: 404 });
  const contentType = uploadContentType(factura.mimeType, filename, "facturas");
  if (!contentType) return new Response("Not found", { status: 404 });
  const bytes = await readUploadFile("facturas", filename);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes, {
    headers: {
      "content-type": contentType,
      "content-disposition": uploadContentDisposition(factura.originalFilename, filename),
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
