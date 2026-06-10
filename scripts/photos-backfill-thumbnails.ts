import { PrismaClient } from "@prisma/client";
import {
  applyThumbnailBackfill,
  buildThumbnailBackfillPlan,
  DEFAULT_THUMBNAIL_BACKFILL_LIMIT,
  type ThumbnailBackfillPhoto,
} from "@/lib/photo-storage";

const prisma = new PrismaClient();

type Args = {
  apply: boolean;
  confirmed: boolean;
  force: boolean;
  limit: number | null;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.apply) {
    const plan = await buildThumbnailBackfillPlan(prisma);
    printPlan(plan);
    console.log("");
    console.log("Dry run only. No files or database records were changed.");
    console.log("Before applying, run npm run backup and review the candidate counts.");
    console.log(`Apply example: npm run photos:backfill-thumbnails:apply -- --confirm --limit ${DEFAULT_THUMBNAIL_BACKFILL_LIMIT}`);
    return;
  }

  if (!args.confirmed) {
    throw new Error("Apply requires confirmation. Run dry-run first, run npm run backup, then pass --confirm or set CONFIRM_PHOTO_BACKFILL=true.");
  }

  console.log("Thumbnail backfill apply");
  console.log("Backup reminder: run npm run backup before applying to real photo metadata.");
  console.log("Safety: originals are not rewritten, photos are not deleted, and only missing thumbnail metadata/files are repaired.");
  const result = await applyThumbnailBackfill(prisma, { confirmed: true, limit: args.limit, force: args.force });
  printPlan(result.plan);
  console.log("");
  console.log(`Attempted: ${result.attempted}`);
  console.log(`Created thumbnails: ${result.created}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Failed: ${result.failed.length}`);
  console.log(`Limit: ${result.limit ?? "none"}`);
  if (result.failed.length) {
    console.log("Failures:");
    for (const failure of result.failed.slice(0, 25)) console.log(`- ${failure.kind} ${failure.id}: ${failure.message}`);
  }
}

function parseArgs(argv: string[]): Args {
  const limitArg = argv.find((arg) => arg === "--limit" || arg.startsWith("--limit="));
  let limit: number | null = null;
  if (limitArg === "--limit") {
    const value = argv[argv.indexOf(limitArg) + 1];
    limit = Number(value);
  } else if (limitArg?.startsWith("--limit=")) {
    limit = Number(limitArg.split("=")[1]);
  }
  if (limit != null && (!Number.isFinite(limit) || limit <= 0)) limit = DEFAULT_THUMBNAIL_BACKFILL_LIMIT;
  return {
    apply: argv.includes("--apply"),
    confirmed: argv.includes("--confirm") || process.env.CONFIRM_PHOTO_BACKFILL === "true",
    force: argv.includes("--force"),
    limit,
  };
}

function printPlan(plan: Awaited<ReturnType<typeof buildThumbnailBackfillPlan>>) {
  console.log("Thumbnail backfill dry-run summary");
  console.log(`Generated at: ${plan.generatedAt}`);
  console.log(`Total photos: ${plan.totalPhotos}`);
  console.log(`Asset photos: ${plan.assetPhotoCount}`);
  console.log(`Stock photos: ${plan.stockPhotoCount}`);
  console.log(`Backfill candidates: ${plan.candidates.length}`);
  console.log(`Estimated output thumbnails: ${plan.estimatedOutputThumbnailCount}`);
  console.log(`Already ready: ${plan.alreadyReady.length}`);
  console.log(`Missing originals: ${plan.missingOriginals.length}`);
  console.log(`Oversized photos: ${plan.oversizedPhotos.length}`);
  console.log(`Unsupported photos: ${plan.unsupportedPhotos.length}`);
  printExamples("Backfill candidates", plan.candidates);
  printExamples("Missing originals", plan.missingOriginals);
  printExamples("Oversized photos", plan.oversizedPhotos);
  printExamples("Unsupported photos", plan.unsupportedPhotos);
}

function printExamples(title: string, photos: ThumbnailBackfillPhoto[]) {
  if (!photos.length) return;
  console.log("");
  console.log(`${title} (first ${Math.min(photos.length, 20)}):`);
  for (const photo of photos.slice(0, 20)) {
    console.log(`- ${photo.kind} ${photo.id}: ${photo.ownerLabel} / ${photo.storedFilename} / ${photo.mimeType ?? "unknown"} / ${formatBytes(photo.sizeBytes)}`);
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
