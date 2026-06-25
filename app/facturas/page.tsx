import Link from "next/link";
import { Plus, ReceiptText, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { hasPagePermission } from "@/lib/page-permissions";
import { Badge } from "@/components/badge";
import { activeFacturaWhere, facturaStatusLabels, facturaStatusTone } from "@/lib/facturas";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FacturasPage({ searchParams }: Props) {
  const canWriteInventory = await hasPagePermission("inventory.write");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const showArchived = params.showArchived === "true";
  const facturas = await prisma.factura.findMany({
    where: {
      ...activeFacturaWhere(showArchived),
      ...(q
        ? {
          OR: [
            { facturaNumber: { contains: q } },
            { vendorName: { contains: q } },
            { vendorRfc: { contains: q } },
            { poNumber: { contains: q } },
            { notes: { contains: q } },
          ],
        }
        : {}),
    },
    include: { _count: { select: { assets: true, stockItems: true, stockMovements: true } } },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturas"
        description="Purchase records, vendor details, attached files, and linked assets or stock."
        action={
          canWriteInventory ? <Link href="/facturas/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            <Plus size={16} />
            Add factura
          </Link> : null
        }
      />

      <form className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="relative block">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input name="q" defaultValue={q} className="min-h-12 w-full rounded-md border border-slate-300 pl-10 pr-3 text-base" placeholder="Search factura, vendor, RFC, PO" />
        </label>
        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" name="showArchived" value="true" defaultChecked={showArchived} className="size-4 rounded border-slate-300" />
          Show archived / void / invalid facturas
        </label>
      </form>

      <section className="grid gap-3 lg:hidden">
        {facturas.map((factura) => (
          <article key={factura.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-950">{factura.facturaNumber}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge className={facturaStatusTone(factura.status)}>{facturaStatusLabels[factura.status]}</Badge>
              <p className="text-sm text-slate-600">{factura.vendorName}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Total</span><p className="font-semibold">{factura.totalAmount != null ? `${factura.currency} ${factura.totalAmount.toFixed(2)}` : "-"}</p></div>
              <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Links</span><p className="font-semibold">{factura._count.assets + factura._count.stockItems}</p></div>
            </div>
            <Link href={`/facturas/${factura.id}`} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
              <ReceiptText size={17} />
              Open
            </Link>
          </article>
        ))}
      </section>

      <section className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Factura</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Purchase date</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Linked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {facturas.map((factura) => (
              <tr key={factura.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><Link className="font-medium text-slate-950 hover:underline" href={`/facturas/${factura.id}`}>{factura.facturaNumber}</Link></td>
                <td className="px-4 py-3"><Badge className={facturaStatusTone(factura.status)}>{facturaStatusLabels[factura.status]}</Badge></td>
                <td className="px-4 py-3">{factura.vendorName}</td>
                <td className="px-4 py-3">{factura.purchaseDate ? factura.purchaseDate.toLocaleDateString() : "-"}</td>
                <td className="px-4 py-3">{factura.totalAmount != null ? `${factura.currency} ${factura.totalAmount.toFixed(2)}` : "-"}</td>
                <td className="px-4 py-3">{factura._count.assets} assets, {factura._count.stockItems} stock</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {facturas.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No facturas found.</p> : null}
    </div>
  );
}
