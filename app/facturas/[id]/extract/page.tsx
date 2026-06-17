import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { FacturaExtractionReview } from "@/components/factura-extraction-review";
import { PageHeader } from "@/components/page-header";
import { hasPagePermission } from "@/lib/page-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function FacturaExtractPage({ params }: Props) {
  const canWriteInventory = await hasPagePermission("inventory.write");
  if (!canWriteInventory) redirect("/login");
  const { id } = await params;
  const factura = await prisma.factura.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { createdAt: "asc" } },
      extractionAttempts: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!factura) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Extract ${factura.facturaNumber}`}
        description="Assisted local PDF text and XML extraction. Review, edit, and confirm before creating line items."
        action={
          <div className="grid gap-2 sm:flex">
            <Link href={`/facturas/${factura.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ArrowLeft size={16} />
              Back to factura
            </Link>
            <Link href={`/facturas/${factura.id}/line-items/new`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <Plus size={16} />
              Manual line item
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Vendor" value={factura.vendorName} />
        <InfoCard label="PDF/photo" value={factura.originalFilename || factura.storedFilename || "No file"} />
        <InfoCard label="XML" value={factura.xmlOriginalName || factura.xmlFilename || "No XML"} />
        <InfoCard label="Existing line items" value={String(factura.lineItems.length)} />
        <InfoCard label="Last attempt" value={factura.extractionAttempts[0] ? `${factura.extractionAttempts[0].status} / ${factura.extractionAttempts[0].candidateCount} candidates` : "None"} />
      </section>

      {!factura.filePath && !factura.xmlPath ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This factura has no PDF or XML attachment. Add line items manually or upload a supported factura file first.</section>
      ) : null}

      <FacturaExtractionReview facturaId={factura.id} hasExistingLineItems={factura.lineItems.length > 0} hasPdfAttachment={Boolean(factura.filePath)} hasXmlAttachment={Boolean(factura.xmlPath)} />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
