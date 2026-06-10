import { createBackup } from "@/lib/backups";

async function main() {
  const result = await createBackup();
  const { manifest, validation } = result;
  console.log(`Backup created at: ${manifest.backupPath}`);
  console.log(`Database copied: ${manifest.databaseCopied ? "yes" : "no"} (${manifest.databaseFileSize} bytes)`);
  console.log(`Asset photos: ${manifest.uploadsAssetsCopied ? `${manifest.uploadsAssetsFileCount} file(s)` : "folder missing"}`);
  console.log(`Factura files: ${manifest.uploadsFacturasCopied ? `${manifest.uploadsFacturasFileCount} file(s)` : "folder missing"}`);
  console.log(`Stock photos: ${manifest.uploadsStockCopied ? `${manifest.uploadsStockFileCount ?? 0} file(s)` : "folder missing"}`);
  console.log(`Map images: ${manifest.uploadsMapsCopied ? `${manifest.uploadsMapsFileCount ?? 0} file(s)` : "folder missing"}`);
  console.log(`Manifest: ${validation.manifestExists ? "written" : "missing"}`);
  console.log(`Validation: ${validation.valid ? "passed" : "failed"}`);
  if (manifest.warnings.length || validation.warnings.length) {
    console.log("Warnings:");
    for (const warning of [...manifest.warnings, ...validation.warnings]) console.log(`- ${warning}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
