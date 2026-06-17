import { prisma } from "@/lib/prisma";
import { readUploadFile, uploadContentDisposition, uploadContentType, isSafeUploadFilename } from "@/lib/uploads";

export const runtime = "nodejs";

type Context = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, context: Context) {
  const { filename } = await context.params;
  if (!isSafeUploadFilename(filename)) return new Response("Not found", { status: 404 });
  const factura = await prisma.factura.findFirst({
    where: { OR: [{ storedFilename: filename }, { xmlFilename: filename }] },
  });
  if (!factura) return new Response("Not found", { status: 404 });
  const isXml = factura.xmlFilename === filename;
  const contentType = uploadContentType(isXml ? factura.xmlMimeType : factura.mimeType, filename, "facturas");
  if (!contentType) return new Response("Not found", { status: 404 });
  const bytes = await readUploadFile("facturas", filename);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes, {
    headers: {
      "content-type": contentType,
      "content-disposition": uploadContentDisposition(isXml ? factura.xmlOriginalName : factura.originalFilename, filename),
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
