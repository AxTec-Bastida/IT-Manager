import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPageRole } from "@/lib/page-permissions";
import { DeviceCategory, TaskCategory, StockCategory } from "@prisma/client";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPageRole("ADMIN"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, isActive } = body;

    const existingVal = await prisma.controlledValue.findUnique({ where: { id } });
    if (!existingVal) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: {
      name?: string;
      normalizedName?: string;
      description?: string;
      isActive?: boolean;
    } = {};
    if (description !== undefined) data.description = description;
    if (isActive !== undefined) data.isActive = isActive;

    if (name) {
      const trimmedName = name.trim();
      const normalized = trimmedName.toUpperCase();

      // Check if another record has this name
      const duplicate = await prisma.controlledValue.findFirst({
        where: {
          type: existingVal.type,
          normalizedName: normalized,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A controlled value with this name already exists for this type." },
          { status: 400 }
        );
      }

      data.name = trimmedName;
      data.normalizedName = normalized;
    }

    const updated = await prisma.controlledValue.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unable to update controlled value" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPageRole("ADMIN"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const val = await prisma.controlledValue.findUnique({ where: { id } });
    if (!val) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Usage check
    let inUse = false;
    if (val.type === "ASSET_CATEGORY") {
      const count = await prisma.device.count({ where: { category: val.name as DeviceCategory } });
      if (count > 0) inUse = true;
    } else if (val.type === "BRAND") {
      const count = await prisma.device.count({ where: { brand: val.name } });
      if (count > 0) inUse = true;
    } else if (val.type === "MODEL") {
      const count = await prisma.device.count({ where: { model: val.name } });
      if (count > 0) inUse = true;
    } else if (val.type === "LOCATION") {
      const count = await prisma.device.count({ where: { location: val.name } });
      if (count > 0) inUse = true;
    } else if (val.type === "AREA" || val.type === "DEPARTMENT") {
      const count = await prisma.device.count({ where: { areaDepartment: val.name } });
      if (count > 0) inUse = true;
    } else if (val.type === "TASK_CATEGORY") {
      const count = await prisma.task.count({ where: { category: val.name as TaskCategory } });
      if (count > 0) inUse = true;
    } else if (val.type === "STOCK_CATEGORY") {
      const count = await prisma.stockItem.count({ where: { category: val.name as StockCategory } });
      if (count > 0) inUse = true;
    }

    if (inUse) {
      return NextResponse.json(
        { error: "This value is used by existing records. Deactivate it instead or migrate records first." },
        { status: 400 }
      );
    }

    await prisma.controlledValue.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete controlled value" }, { status: 500 });
  }
}
