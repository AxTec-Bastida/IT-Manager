import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { uploadStoragePath } from "@/lib/uploads";

export const runtime = "nodejs";

type Context = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, context: Context) {
  const { filename } = await context.params;
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) return new Response("Not found", { status: 404 });
  const photo = await prisma.assetPhoto.findFirst({ where: { storedFilename: filename } });
  if (!photo) return new Response("Not found", { status: 404 });
  const filePath = uploadStoragePath("assets", filename);
  const bytes = await readFile(filePath).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes, {
    headers: {
      "content-type": photo.mimeType,
      "content-disposition": `inline; filename="${path.basename(photo.originalFilename || filename)}"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
