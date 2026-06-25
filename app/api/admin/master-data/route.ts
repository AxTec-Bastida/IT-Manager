import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPageRole } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await hasPageRole("ADMIN"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const q = searchParams.get("q");

  const where: {
    type?: string;
    name?: { contains: string };
  } = {};
  if (type) {
    where.type = type;
  }
  if (q) {
    where.name = { contains: q };
  }

  const values = await prisma.controlledValue.findMany({
    where,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(values);
}

export async function POST(request: Request) {
  if (!(await hasPageRole("ADMIN"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, name, description, isActive } = body;

    if (!type || !name) {
      return NextResponse.json({ error: "Type and Name are required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const normalized = trimmedName.toUpperCase();

    // Check for duplicate
    const existing = await prisma.controlledValue.findUnique({
      where: {
        type_normalizedName: {
          type,
          normalizedName: normalized,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A controlled value with this name and type already exists." },
        { status: 400 }
      );
    }

    const newValue = await prisma.controlledValue.create({
      data: {
        type,
        name: trimmedName,
        normalizedName: normalized,
        description,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(newValue);
  } catch {
    return NextResponse.json({ error: "Unable to create controlled value" }, { status: 500 });
  }
}
