import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BitLockerVaultForm } from "@/components/bitlocker-vault-form";
import { PageHeader } from "@/components/page-header";
import { canManageBitLockerKey, isBitLockerEligibleCategory, sanitizeBitLockerRecord, validateVaultSecret } from "@/lib/bitlocker-vault";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditDeviceBitLockerPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageBitLockerKey(user)) redirect("/dashboard");
  const { id } = await params;
  const device = await prisma.device.findUnique({ where: { id }, include: { bitLockerRecoveryKey: true } });
  if (!device) notFound();
  const eligible = isBitLockerEligibleCategory(device.category);
  const vaultSecret = validateVaultSecret();
  const record = sanitizeBitLockerRecord(device.bitLockerRecoveryKey, { includeRestrictedMetadata: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title={record ? "Edit BitLocker Vault" : "Add BitLocker Key"}
        description={`${device.assetTag || device.name}. Recovery key values are encrypted before storage and never rendered by default.`}
        action={
          <Link href={`/devices/${device.id}/bitlocker`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <ArrowLeft size={16} />
            Back to vault
          </Link>
        }
      />
      {!eligible ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">BitLocker vault records are only available for laptop and desktop assets.</section>
      ) : !vaultSecret.usable ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Set <code className="rounded bg-white px-1 font-semibold">BITLOCKER_VAULT_SECRET</code> to at least 32 characters before creating or updating BitLocker vault records.
        </section>
      ) : (
        <BitLockerVaultForm deviceId={device.id} existingRecord={"keyId" in (record ?? {}) ? record : null} />
      )}
    </div>
  );
}
