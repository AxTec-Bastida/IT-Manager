import type { DeviceCategory, DeviceCondition, DeviceStatus, PrismaClient } from "@prisma/client";

export type GhtLpLaptopCandidate = {
  id: string;
  name: string;
  category: DeviceCategory | string;
  assetTag: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  status: DeviceStatus | string;
  condition: DeviceCondition | string;
  employee?: { fullName: string; employeeId: string | null } | null;
  assignedTo?: string | null;
};

export type GhtLpLaptopCleanupPlan = {
  id: string;
  currentName: string;
  suggestedName: string;
  currentCategory: string;
  suggestedCategory: "LAPTOP";
  assetTag: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  assignedEmployee: string | null;
  status: string;
  condition: string;
};

type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export function isGhtLpLatitudeLaptopCleanupCandidate(device: GhtLpLaptopCandidate) {
  const assetTag = normalize(device.assetTag);
  const name = normalize(device.name);
  const brand = normalize(device.brand);
  const model = normalize(device.model);
  const category = String(device.category);
  const isGhtLp = assetTag.startsWith("ght-lp");
  const latitude = model.includes("latitude");
  const dellLaptop = brand.includes("dell") || model.includes("dell") || latitude;
  const importedAsAccessPoint = name.includes("access point") || category === "ACCESS_POINT";
  return Boolean(isGhtLp && dellLaptop && importedAsAccessPoint);
}

export function suggestedGhtLpLaptopName(device: Pick<GhtLpLaptopCandidate, "brand" | "model" | "assetTag">) {
  const brand = clean(device.brand);
  const model = clean(device.model);
  const combined = [brand, model].filter(Boolean).join(" ").trim();
  return combined || device.assetTag || "Laptop";
}

export function buildGhtLpLaptopCleanupPlan(device: GhtLpLaptopCandidate): GhtLpLaptopCleanupPlan | null {
  if (!isGhtLpLatitudeLaptopCleanupCandidate(device)) return null;
  return {
    id: device.id,
    currentName: device.name,
    suggestedName: suggestedGhtLpLaptopName(device),
    currentCategory: String(device.category),
    suggestedCategory: "LAPTOP",
    assetTag: device.assetTag,
    serialNumber: device.serialNumber,
    brand: device.brand,
    model: device.model,
    assignedEmployee: device.employee ? [device.employee.fullName, device.employee.employeeId].filter(Boolean).join(" / ") : device.assignedTo ?? null,
    status: String(device.status),
    condition: String(device.condition),
  };
}

export function ghtLpLaptopCleanupUpdateData(plan: GhtLpLaptopCleanupPlan) {
  return {
    name: plan.suggestedName,
    category: plan.suggestedCategory,
  } as const;
}

export async function findGhtLpLaptopCleanupPlans(prisma: PrismaClient): Promise<GhtLpLaptopCleanupPlan[]> {
  const devices = await prisma.device.findMany({
    where: {
      assetTag: { startsWith: "GHT-LP" },
      OR: [{ name: { contains: "ACCESS POINT" } }, { category: "ACCESS_POINT" }, { brand: { contains: "DELL" } }, { model: { contains: "DELL" } }],
    },
    select: {
      id: true,
      name: true,
      category: true,
      assetTag: true,
      serialNumber: true,
      brand: true,
      model: true,
      status: true,
      condition: true,
      assignedTo: true,
      employee: { select: { fullName: true, employeeId: true } },
    },
    orderBy: { assetTag: "asc" },
  });
  return devices.map(buildGhtLpLaptopCleanupPlan).filter((plan): plan is GhtLpLaptopCleanupPlan => Boolean(plan));
}

export async function applyGhtLpLaptopCleanup(prisma: PrismaClient, plans: GhtLpLaptopCleanupPlan[]) {
  let corrected = 0;
  const correctedIds: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const plan of plans) {
      await applyGhtLpLaptopCleanupPlan(tx, plan);
      corrected += 1;
      correctedIds.push(plan.id);
    }
  });
  return { corrected, correctedIds };
}

async function applyGhtLpLaptopCleanupPlan(tx: Tx, plan: GhtLpLaptopCleanupPlan) {
  await tx.device.update({
    where: { id: plan.id },
    data: ghtLpLaptopCleanupUpdateData(plan),
  });
  await tx.activityLog.create({
    data: {
      action: "asset.import_cleanup.ght_lp_laptop",
      entity: "device",
      entityId: plan.id,
      message: "Corrected imported laptop record from Access Point to Laptop.",
      metadata: JSON.stringify({
        previousName: plan.currentName,
        previousCategory: plan.currentCategory,
        newName: plan.suggestedName,
        newCategory: plan.suggestedCategory,
        assetTag: plan.assetTag,
        serialNumber: plan.serialNumber,
      }),
    },
  });
}

function normalize(value: unknown) {
  return clean(value).toLowerCase();
}

function clean(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}
