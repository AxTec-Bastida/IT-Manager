import { describe, expect, it, vi } from "vitest";
import { createAssetPhotoUpload } from "@/lib/asset-photos";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/uploads", () => ({
  validateUploadFile: () => ({ ok: true, message: "" }),
  generateSafeFilename: () => "safe-filename.jpg",
  saveUploadedFile: async () => {},
  generateThumbnailForUpload: async () => ({
    width: 100,
    height: 100,
    thumbnailFilename: "thumb.jpg",
    thumbnailPath: "/thumbs/thumb.jpg",
  }),
  normalizePhotoType: (type: unknown) => type,
  shouldSetPrimaryPhoto: () => true,
  publicUploadPath: (folder: string, name: string) => `/uploads/${folder}/${name}`,
  normalizePhotoSource: (src: unknown) => src || "CAMERA",
}));

describe("damage photo uploads", () => {
  it("stores DAMAGE photos without silently changing the device condition", async () => {
    const mockFile = new File(["dummy"], "damage.jpg", { type: "image/jpeg" });
    const actor = { id: "user-1", name: "IT Test Admin", role: "ADMIN" };

    const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
    const createPhotoMock = vi.fn().mockResolvedValue({
      id: "photo-1",
      photoType: "DAMAGE",
      isPrimary: true,
    });
    const updateDeviceMock = vi.fn().mockResolvedValue({ id: "device-1", condition: "DAMAGED" });
    const logCreateMock = vi.fn().mockResolvedValue({});

    const client = {
      device: {
        findUnique: vi.fn().mockResolvedValue({ id: "device-1", name: "Test Laptop" }),
        update: updateDeviceMock,
      },
      assetPhoto: {
        count: vi.fn().mockResolvedValue(0),
        updateMany: updateManyMock,
        create: createPhotoMock,
      },
      activityLog: {
        create: logCreateMock,
      },
    } as unknown as PrismaClient;

    const result = await createAssetPhotoUpload({
      assetId: "device-1",
      file: mockFile,
      actor,
      photoType: "DAMAGE",
      client,
    });

    expect(result.ok).toBe(true);
    // Verify it set existing photos as not primary
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { assetId: "device-1" },
      data: { isPrimary: false },
    });
    // Verify it created the photo as primary
    expect(createPhotoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          photoType: "DAMAGE",
          isPrimary: true,
        }),
      })
    );
    expect(updateDeviceMock).not.toHaveBeenCalled();
  });
});
