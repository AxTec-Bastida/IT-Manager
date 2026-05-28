import { prisma } from "@/lib/prisma";
import { runDueJobs } from "@/lib/jobs";

async function main() {
  const summary = await runDueJobs(prisma);
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
