import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deviceSchema } from "@/lib/validation";
import { ClientInputError, handleApiError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

const defaultLimit = 50;
const maxLimit = 100;

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new ClientInputError("Pagination values must be positive whole numbers.");
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("inventory.read");
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;
    const vlan = searchParams.get("vlan") ? Number(searchParams.get("vlan")) : undefined;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), defaultLimit), maxLimit);

    const where = {
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { assetTag: { contains: query } },
              { ipAddress: { contains: query } },
              { macAddress: { contains: query } },
              { serialNumber: { contains: query } },
              { location: { contains: query } },
              { areaDepartment: { contains: query } },
              { assignedTo: { contains: query } },
              { brand: { contains: query } },
              { model: { contains: query } },
            ],
          }
        : {}),
      ...(category ? { category: category as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(vlan ? { vlan } : {}),
    };

    const [total, devices] = await Promise.all([
      prisma.device.count({ where }),
      prisma.device.findMany({
        where,
        select: {
          id: true,
          assetTag: true,
          name: true,
          category: true,
          status: true,
          condition: true,
          brand: true,
          model: true,
          serialNumber: true,
          location: true,
          areaDepartment: true,
          ipAddress: true,
          macAddress: true,
          vlan: true,
          assignedTo: true,
          employee: { select: { id: true, fullName: true, employeeId: true } },
          updatedAt: true,
        },
        orderBy: [{ status: "asc" }, { ipAddress: "asc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      devices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("inventory.write");
    const payload = await request.json();
    const data = deviceSchema.parse(payload);
    const device = await prisma.device.create({ data });

    await prisma.activityLog.create({
      data: {
        action: data.status === "RESERVED" ? "ip.reserved" : "device.created",
        entity: "device",
        entityId: device.id,
        message: `${device.name} was ${data.status === "RESERVED" ? "reserved" : "created"} at ${device.ipAddress}.`,
      },
    });

    return NextResponse.json({ device }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
