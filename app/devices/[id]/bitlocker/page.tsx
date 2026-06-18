import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Edit, ShieldCheck } from "lucide-react";
import { BitLockerRevealPanel } from "@/components/bitlocker-reveal-panel";
import { PageHeader } from "@/components/page-header";
import { ActionLink } from "@/components/ui-patterns";
import { canManageBitLockerKey, canRevealBitLockerKey, isBitLockerEligibleCategory, sanitizeBitLockerRecord, validateVaultSecret } from "@/lib/bitlocker-vault";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ saved?: string }> };

export default async function DeviceBitLockerPage({ params, searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const device = await prisma.device.findUnique({ where: { id }, include: { bitLockerRecoveryKey: true } });
  if (!device) notFound();

  const eligible = isBitLockerEligibleCategory(device.category);
  const canManage = canManageBitLockerKey(user);
  const canReveal = canRevealBitLockerKey(user);
  const record = sanitizeBitLockerRecord(device.bitLockerRecoveryKey, { includeRestrictedMetadata: user.role !== "VIEWER" });
  const vaultSecret = validateVaultSecret();

  return (
    <div className="space-y-6">
      <PageHeader
        title="BitLocker Vault"
        description={`${device.assetTag || device.name} recovery-key tracking. Keys are hidden until explicit reveal.`}
        action={
          <div className="grid gap-2 sm:flex">
            <Link href={`/devices/${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ArrowLeft size={16} />
              Back to asset
            </Link>
            {canManage && eligible ? (
              <Link href={`/devices/${device.id}/bitlocker/edit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                <Edit size={16} />
                {record ? "Edit vault" : "Add key"}
              </Link>
            ) : null}
          </div>
        }
      />

      {query.saved ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">BitLocker vault record saved.</p> : null}

      {!eligible ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">BitLocker vault records are only available for laptop and desktop assets.</section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-slate-100 p-2 text-slate-700"><ShieldCheck size={18} /></div>
          <div>
            <h2 className="font-semibold text-slate-950">Protected Recovery Key</h2>
            <p className="mt-1 text-sm text-slate-600">The stored key is encrypted in the database. The decrypted value is only returned by the reveal endpoint for Admin users.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Key exists" value={record ? "Yes" : "No"} />
          <Info label="Key ID" value={"keyId" in (record ?? {}) ? String(record?.keyId || "-") : record ? "Restricted" : "-"} />
          <Info label="Volume" value={"volumeLabel" in (record ?? {}) ? String(record?.volumeLabel || "-") : record ? "Restricted" : "-"} />
          <Info label="Last viewed" value={"lastViewedAt" in (record ?? {}) && record?.lastViewedAt ? new Date(record.lastViewedAt).toLocaleString() : record ? "Not viewed" : "-"} />
        </div>
        {!vaultSecret.usable ? (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">BITLOCKER_VAULT_SECRET is not configured or is too short. Create and reveal operations are blocked until it is set.</p>
        ) : null}
        {!record && canManage && eligible ? (
          <div className="mt-4"><ActionLink href={`/devices/${device.id}/bitlocker/edit`}>Add BitLocker key</ActionLink></div>
        ) : null}
        {record && canReveal ? <div className="mt-4"><BitLockerRevealPanel deviceId={device.id} /></div> : null}
        {record && !canReveal ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">A protected key exists. Contact an Admin to reveal it when recovery is required.</p> : null}
      </section>

      {"createdByName" in (record ?? {}) ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Vault Metadata</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Info label="Protector ID" value={String(record?.protectorId || "-")} />
            <Info label="Source" value={String(record?.source || "-")} />
            <Info label="Created by" value={String(record?.createdByName || "-")} />
            <Info label="Updated by" value={String(record?.updatedByName || record?.createdByName || "-")} />
          </div>
          {record?.notes ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{record.notes}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
