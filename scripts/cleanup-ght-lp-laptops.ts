import { prisma } from "@/lib/prisma";
import { applyGhtLpLaptopCleanup, findGhtLpLaptopCleanupPlans } from "@/lib/ght-lp-cleanup";

async function main() {
  const apply = process.argv.includes("--apply");
  const plans = await findGhtLpLaptopCleanupPlans(prisma);
  const result = {
    mode: apply ? "apply" : "dry-run",
    matched: plans.length,
    corrected: 0,
    rows: plans,
  };

  if (apply && plans.length) {
    const applied = await applyGhtLpLaptopCleanup(prisma, plans);
    result.corrected = applied.corrected;
  }

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
