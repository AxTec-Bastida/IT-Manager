import { AlertTriangle, CheckCircle2, Database, FolderArchive, HardDrive, Image, ReceiptText } from "lucide-react";
import { Badge } from "@/components/badge";
import { CreateBackupButton } from "@/components/create-backup-button";
import { PageHeader } from "@/components/page-header";
import { EmptyState, MobileCard, SectionCard } from "@/components/ui-patterns";
import { getBackupHistory } from "@/lib/backups";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPageRole } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export default async function BackupsPage() {
  if (!(await hasPageRole("ADMIN"))) return <ForbiddenPanel message="Backup management is admin-only." />;
  const backups = await getBackupHistory();
  const latest = backups[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backups"
        description="Create and review local safety copies of the SQLite database, asset photos, factura files, and backup manifests."
        action={<CreateBackupButton />}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={FolderArchive} label="Recent Backups" value={backups.length} helper="Manifest-backed folders" />
        <SummaryCard icon={Database} label="Latest Database" value={latest?.databaseCopied ? "Included" : "None"} helper={latest ? formatDate(latest.backupTimestamp) : "Run npm run backup"} />
        <SummaryCard icon={Image} label="Asset Files" value={latest?.uploadsAssetsCopied ? latest.uploadsAssetsFileCount : 0} helper={latest?.uploadsAssetsCopied ? "Copied in latest backup" : "Missing or no backup yet"} />
        <SummaryCard icon={ReceiptText} label="Factura Files" value={latest?.uploadsFacturasCopied ? latest.uploadsFacturasFileCount : 0} helper={latest?.uploadsFacturasCopied ? "Copied in latest backup" : "Missing or no backup yet"} />
        <SummaryCard icon={Image} label="Stock Photos" value={latest?.uploadsStockCopied ? latest.uploadsStockFileCount ?? 0 : 0} helper={latest?.uploadsStockCopied ? "Copied in latest backup" : "Missing or no backup yet"} />
      </section>

      <SectionCard className="border-amber-200 bg-amber-50">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={18} />
          <div className="text-sm text-amber-950">
            <p className="font-semibold">Restore is manual for safety.</p>
            <p className="mt-1">Stop the app, back up the current state if possible, then restore the matching database and upload folders together. Restoring only the database or only files can break asset photo, stock photo, and factura links.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="font-semibold text-slate-950">Backup Command</h2>
        <p className="mt-1 text-sm text-slate-600">Run this from the project folder before imports, migrations, major cleanup work, or daily operational changes.</p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-slate-950 p-3 text-sm text-white">npm run backup</pre>
        <p className="mt-3 text-sm text-slate-600">The default output is <span className="font-mono">backups/manual-YYYYMMDD-HHMMSS/</span>. Set <span className="font-mono">BACKUP_DIR</span> only if you need a different backup root.</p>
      </SectionCard>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-slate-950">Backup History</h2>
          <p className="text-sm text-slate-500">Recent folders with readable backup manifests.</p>
        </div>
        {backups.length ? (
          <div className="grid gap-3">
            {backups.slice(0, 20).map((backup) => (
              <MobileCard key={backup.backupPath}>
                <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={backup.status === "SUCCESS" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-800 ring-rose-200"}>{backup.status}</Badge>
                      <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{formatBytes(backup.sizeBytes)}</Badge>
                    </div>
                    <h3 className="mt-3 break-words font-semibold text-slate-950">{formatDate(backup.backupTimestamp)}</h3>
                    <p className="mt-1 break-all text-sm text-slate-600">{backup.backupPath}</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-4">
                      <BackupSignal label="Database" ok={backup.databaseCopied} detail={formatBytes(backup.databaseFileSize)} />
                      <BackupSignal label="Assets" ok={backup.uploadsAssetsCopied} detail={`${backup.uploadsAssetsFileCount} file(s)`} />
                      <BackupSignal label="Facturas" ok={backup.uploadsFacturasCopied} detail={`${backup.uploadsFacturasFileCount} file(s)`} />
                      <BackupSignal label="Stock photos" ok={Boolean(backup.uploadsStockCopied)} detail={`${backup.uploadsStockFileCount ?? 0} file(s)`} />
                    </div>
                    {backup.warnings.length ? (
                      <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                        <p className="font-semibold">Warnings</p>
                        <ul className="mt-1 list-inside list-disc">
                          {backup.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                    <p className="font-semibold text-slate-950">Manifest</p>
                    <p className="mt-1">App: {backup.appName}</p>
                    <p>Version: {backup.appVersion}</p>
                    <p>Git: {backup.gitCommitHash?.slice(0, 12) ?? "not available"}</p>
                  </div>
                </div>
              </MobileCard>
            ))}
          </div>
        ) : (
          <EmptyState title="No backup manifests found" description="Run npm run backup or use Create backup to make the first local backup." />
        )}
      </section>

      <SectionCard>
        <h2 className="font-semibold text-slate-950">OneDrive File Lock Warning</h2>
        <p className="mt-1 text-sm text-slate-600">
          This project currently runs under <span className="font-mono">C:\Users\abastida\OneDrive - TechStyle\Documents\New project 3</span>. OneDrive can lock <span className="font-mono">.next</span>, SQLite, and Prisma files during sync. Keep backups there if useful, but plan to run the active app from <span className="font-mono">C:\Dev\warehouse-it-inventory</span> when the workflow is ready.
        </p>
      </SectionCard>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, helper }: { icon: React.ElementType; label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <Icon className="text-slate-400" size={20} />
      </div>
    </div>
  );
}

function BackupSignal({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-3">
      {ok ? <CheckCircle2 className="shrink-0 text-emerald-700" size={16} /> : <HardDrive className="shrink-0 text-slate-400" size={16} />}
      <span>
        <span className="font-semibold text-slate-950">{label}</span>
        <span className="block text-xs text-slate-500">{ok ? detail : "not included"}</span>
      </span>
    </div>
  );
}
