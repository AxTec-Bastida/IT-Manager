import { NextRequest, NextResponse } from "next/server";
import { ClientInputError, handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { calculateDepreciation, defaultUsefulLifeMonths } from "@/lib/depreciation";
import { prisma } from "@/lib/prisma";
import { assetValueProfileSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const input = assetValueProfileSchema.parse(await request.json());
    if (input.purchaseValue == null) throw new ClientInputError("Purchase value is required.");

    const device = await prisma.device.findUnique({ where: { id }, include: { valueProfile: true } });
    if (!device) return jsonError("Asset not found.", 404);

    const calculation = calculateDepreciation({
      purchaseValue: input.purchaseValue,
      purchaseDate: input.purchaseDate ?? device.purchaseDate,
      usefulLifeMonths: input.usefulLifeMonths ?? defaultUsefulLifeMonths(device.category),
      residualPercent: input.residualPercent,
      category: device.category,
    });

    const profile = await prisma.assetValueProfile.upsert({
      where: { deviceId: device.id },
      create: {
        deviceId: device.id,
        purchaseValue: input.purchaseValue,
        currency: input.currency,
        purchaseDate: input.purchaseDate ?? device.purchaseDate,
        depreciationMethod: input.depreciationMethod,
        usefulLifeMonths: input.usefulLifeMonths ?? defaultUsefulLifeMonths(device.category),
        residualPercent: input.residualPercent,
        residualValue: calculation.residualValue,
        currentEstimatedValue: calculation.currentEstimatedValue,
        lastCalculatedAt: calculation.lastCalculatedAt,
        notes: input.notes,
      },
      update: {
        purchaseValue: input.purchaseValue,
        currency: input.currency,
        purchaseDate: input.purchaseDate ?? device.purchaseDate,
        depreciationMethod: input.depreciationMethod,
        usefulLifeMonths: input.usefulLifeMonths ?? defaultUsefulLifeMonths(device.category),
        residualPercent: input.residualPercent,
        residualValue: calculation.residualValue,
        currentEstimatedValue: calculation.currentEstimatedValue,
        lastCalculatedAt: calculation.lastCalculatedAt,
        notes: input.notes,
      },
    });

    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "device.value_updated",
        entity: "device",
        entityId: device.id,
        message: `Internal estimated value was updated for ${device.assetTag || device.name}.`,
        metadata: JSON.stringify({
          previousPurchaseValue: device.valueProfile?.purchaseValue ?? null,
          purchaseValue: profile.purchaseValue,
          currency: profile.currency,
          currentEstimatedValue: profile.currentEstimatedValue,
          usefulLifeMonths: profile.usefulLifeMonths,
          residualPercent: profile.residualPercent,
        }),
      },
    });

    return NextResponse.json({ profile, calculation });
  } catch (error) {
    return handleApiError(error);
  }
}
