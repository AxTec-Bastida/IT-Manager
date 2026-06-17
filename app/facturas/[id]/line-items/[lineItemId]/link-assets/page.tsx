import Link from "next/link";
import { notFound } from "next/navigation";
import { FacturaLineItemLinkAssets } from "@/components/factura-line-item-link-assets";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { PageHeader } from "@/components/page-header";
import { hasPagePermission } from "@/lib/page-permissions";
import { prisma } from "@/lib/prisma";
import { categoryOptions } from "@/lib/constants";

type Props = { params: Promise<{ id: string; lineItemId: string }>; searchParams?: Promise<{ q?: string }> };

export default async function LinkFacturaLineItemAssetsPage({ params, searchParams }: Props) {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Linking factura line items requires IT Staff or Admin access." />;
  const { id, lineItemId } = await params;
  const query = searchParams ? await searchParams : {};
  const q = query.q?.trim() ?? "";
  const lineItem = await prisma.facturaLineItem.findFirst({
    where: { id: lineItemId, facturaId: id },
    include: {
      factura: true,
      assetLinks: { include: { device: { include: { valueProfile: true, facturaLineItemLinks: { include: { lineItem: { include: { factura: true } } } } } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!lineItem) notFound();
  const normalizedCategory = q.toUpperCase().replaceAll(" ", "_");
  const categoryFilter = (categoryOptions as readonly string[]).includes(normalizedCategory) ? [{ category: normalizedCategory as never }] : [];
  const assets = q
    ? await prisma.device.findMany({
        where: {
          OR: [
            { assetTag: { contains: q } },
            { serialNumber: { contains: q } },
            { name: { contains: q } },
            { model: { contains: q } },
            ...categoryFilter,
          ],
        },
        include: { valueProfile: true, facturaLineItemLinks: { include: { lineItem: { include: { factura: true } } } } },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        take: 50,
      })
    : [];

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="Link Assets"
        description={`${lineItem.factura.facturaNumber} / ${lineItem.description}`}
        action={<Link href={`/facturas/${id}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Back to factura</Link>}
      />
      <FacturaLineItemLinkAssets facturaId={id} lineItem={lineItem} assets={assets} q={q} />
    </div>
  );
}
