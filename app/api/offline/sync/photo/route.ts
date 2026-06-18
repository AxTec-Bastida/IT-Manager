import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { processOfflinePhotoSyncAction } from "@/lib/offline-photo-sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const formData = await request.formData();
    const payloadText = String(formData.get("payload") || "{}");
    let payload: unknown = {};
    try {
      payload = JSON.parse(payloadText);
    } catch {
      payload = {};
    }
    const file = formData.get("file");
    const result = await processOfflinePhotoSyncAction(
      {
        clientActionId: String(formData.get("clientActionId") || ""),
        actionType: "UPLOAD_ASSET_PHOTO",
        payload,
        createdAt: String(formData.get("createdAt") || ""),
        schemaVersion: Number(formData.get("schemaVersion") || 1),
        file: file instanceof File ? file : null,
      },
      actor,
    );
    return NextResponse.json(result, { status: result.status === "SYNCED" ? 200 : 409 });
  } catch (error) {
    return handleApiError(error);
  }
}
