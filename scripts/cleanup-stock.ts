import { PrismaClient } from "@prisma/client";
import { canArchiveSuspiciousStock, detectSuspiciousStockComments } from "../lib/data-quality";
import { suggestStockCategory } from "../lib/stock-classification";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const backupConfirmed = process.argv.includes("--backup-confirmed");
  const stockItems = await prisma.stockItem.findMany({
    include: {
      stockIssues: { select: { status: true } },
      _count: { select: { movements: true, maintenanceRecords: true, stockIssues: true, purchaseNoteItems: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  const suspicious = detectSuspiciousStockComments(stockItems);
  const archiveCandidates = suspicious.filter((item) => canArchiveSuspiciousStock(item));
  const categoryCandidates = stockItems
    .filter((item) => item.active !== false)
    .map((item) => {
      const suggestion = suggestStockCategory(item);
      return suggestion && suggestion.category !== item.category ? { item, suggestion } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  console.log("Stock cleanup plan");
  console.log(`Stock records reviewed: ${stockItems.length}`);
  console.log(`Suspicious comment-like rows: ${suspicious.length}`);
  console.log(`Safe archive candidates: ${archiveCandidates.length}`);
  console.log(`Category suggestions: ${categoryCandidates.length}`);
  console.log("\nArchive examples:");
  for (const item of archiveCandidates.slice(0, 20)) {
    console.log(JSON.stringify({ id: item.id, name: item.name, quantityOnHand: item.quantityOnHand, category: item.category, reason: item.reason }));
  }
  console.log("\nCategory examples:");
  for (const candidate of categoryCandidates.slice(0, 20)) {
    console.log(JSON.stringify({ id: candidate.item.id, name: candidate.item.name, from: candidate.item.category, to: candidate.suggestion.category, reason: candidate.suggestion.reason }));
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply --backup-confirmed after reviewing the counts.");
    return;
  }
  if (!backupConfirmed) {
    throw new Error("Apply requires --backup-confirmed. Run npm run backup first and review the dry-run output.");
  }

  let archived = 0;
  let categorized = 0;

  for (const item of archiveCandidates) {
    await prisma.stockItem.update({ where: { id: item.id }, data: { active: false } });
    await prisma.activityLog.create({
      data: {
        action: "stock.archive_suspicious_comment",
        entity: "StockItem",
        entityId: item.id,
        message: `Archived imported comment-like stock row ${item.name}.`,
        metadata: JSON.stringify({ reason: item.reason, previousCategory: item.category, quantityOnHand: item.quantityOnHand }),
      },
    });
    archived += 1;
  }

  for (const { item, suggestion } of categoryCandidates) {
    const fresh = await prisma.stockItem.findUnique({ where: { id: item.id }, select: { category: true } });
    if (!fresh || fresh.category === suggestion.category) continue;
    await prisma.stockItem.update({ where: { id: item.id }, data: { category: suggestion.category } });
    await prisma.activityLog.create({
      data: {
        action: "stock.category_applied",
        entity: "StockItem",
        entityId: item.id,
        message: `Applied suggested stock category for ${item.name}.`,
        metadata: JSON.stringify({ previousCategory: fresh.category, newCategory: suggestion.category, reason: suggestion.reason }),
      },
    });
    categorized += 1;
  }

  console.log("\nApplied cleanup:");
  console.log(`Archived suspicious comment rows: ${archived}`);
  console.log(`Applied category suggestions: ${categorized}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
