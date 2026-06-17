import Link from "next/link";
import { notFound } from "next/navigation";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { AssetValueForm } from "@/components/asset-value-form";
import { PageHeader } from "@/components/page-header";
import { canEditAssetValue, formatMoney, buildAssetValueSummary } from "@/lib/depreciation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export default async function AssetValuePage({ params }: Props) {
  const { id } = await params;
  const [device, user] = await Promise.all([
    prisma.device.findUnique({ where: { id }, include: { valueProfile: true } }),
    getCurrentUser(),
  ]);
  if (!device) notFound();
  if (!canEditAssetValue(user)) return <ForbiddenPanel message="You do not have permission to edit asset value estimates." />;

  const summary = buildAssetValueSummary(device);

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title={`Asset Value: ${device.assetTag || device.name}`}
        description="Internal IT estimate only. This is not official accounting book value."
        action={<Link href={`/devices/${device.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">Back to asset</Link>}
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Purchase value" value={formatMoney(summary.purchaseValue, device.valueProfile?.currency ?? "MXN")} />
        <SummaryCard label="Current estimate" value={formatMoney(summary.currentEstimatedValue, device.valueProfile?.currency ?? "MXN")} />
        <SummaryCard label="Useful life" value={`${summary.usefulLifeMonths} months`} />
      </section>
      <AssetValueForm deviceId={device.id} category={device.category} profile={device.valueProfile} devicePurchaseDate={device.purchaseDate} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
