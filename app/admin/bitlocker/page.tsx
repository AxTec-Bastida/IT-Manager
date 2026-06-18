import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ActionLink, EmptyState, MobileCard } from "@/components/ui-patterns";
import { getCurrentUser } from "@/lib/auth";
import { canRevealBitLockerKey, validateVaultSecret } from "@/lib/bitlocker-vault";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminBitLockerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canRevealBitLockerKey(user)) redirect("/dashboard");
  const [withKeys, missingKeys] = await Promise.all([
    prisma.device.findMany({
      where: { category: { in: ["LAPTOP", "DESKTOP"] }, bitLockerRecoveryKey: { isNot: null } },
      include: { bitLockerRecoveryKey: true, employee: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
    }),
    prisma.device.findMany({
      where: { category: { in: ["LAPTOP", "DESKTOP"] }, status: { notIn: ["RETIRED", "DISPOSED"] }, bitLockerRecoveryKey: { is: null } },
      select: { id: true, name: true, assetTag: true, category: true, status: true, employee: true },
      orderBy: [{ assetTag: "asc" }, { name: "asc" }],
      take: 100,
    }),
  ]);
  const vaultSecret = validateVaultSecret();

  return (
    <div className="space-y-6">
      <PageHeader title="BitLocker Vault Admin" description="Sanitized recovery-key coverage overview. Plaintext keys are never listed here." />
      {!vaultSecret.usable ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">BITLOCKER_VAULT_SECRET is missing or too short. Reveal and create operations are blocked.</p> : null}
      <section className="grid gap-3 sm:grid-cols-3">
        <Summary label="Assets with key" value={withKeys.length} />
        <Summary label="Laptops/desktops missing key" value={missingKeys.length} />
        <Summary label="Secret configured" value={vaultSecret.usable ? "Yes" : "No"} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} />
          <h2 className="font-semibold text-slate-950">Assets with protected keys</h2>
        </div>
        {withKeys.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {withKeys.map((asset) => (
              <MobileCard key={asset.id}>
                <h3 className="font-semibold text-slate-950">{asset.assetTag || asset.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{asset.name} / {asset.category.replaceAll("_", " ")}</p>
                <p className="mt-2 text-sm text-slate-500">Key ID: {asset.bitLockerRecoveryKey?.keyId || "-"}</p>
                <p className="text-sm text-slate-500">Last viewed: {asset.bitLockerRecoveryKey?.lastViewedAt ? asset.bitLockerRecoveryKey.lastViewedAt.toLocaleString() : "Not viewed"}</p>
                <div className="mt-3 grid gap-2 sm:flex">
                  <ActionLink href={`/devices/${asset.id}/bitlocker`}>Open vault</ActionLink>
                  <ActionLink href={`/devices/${asset.id}`}>Open asset</ActionLink>
                </div>
              </MobileCard>
            ))}
          </div>
        ) : (
          <EmptyState title="No BitLocker keys yet" description="No laptop or desktop assets currently have vault records." />
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Missing key review</h2>
        {missingKeys.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {missingKeys.slice(0, 40).map((asset) => (
              <MobileCard key={asset.id}>
                <h3 className="font-semibold text-slate-950">{asset.assetTag || asset.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{asset.name} / {asset.category.replaceAll("_", " ")}</p>
                <div className="mt-3 grid gap-2 sm:flex">
                  <ActionLink href={`/devices/${asset.id}/bitlocker/edit`}>Add key</ActionLink>
                  <Link href={`/tasks/new?title=${encodeURIComponent(`Add BitLocker key: ${asset.assetTag || asset.name}`)}&category=INVENTORY&relatedDeviceId=${asset.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Create task</Link>
                </div>
              </MobileCard>
            ))}
          </div>
        ) : (
          <EmptyState title="No eligible assets missing keys" description="Active laptop and desktop assets all have protected vault records." />
        )}
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
