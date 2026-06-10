import { prisma } from "@/lib/prisma";
import { LabelPreviewCard } from "@/components/label-preview";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { barcodeBars, buildLabelPayload, generateBatchPatternLabels, generateRangeLabels, normalizeLabelOptions, parseLabelTagList, parseManualLabelList, validateLabelPayload, type LabelItem, type LabelMode, type LabelOptions } from "@/lib/labels";
import { aliasPreviewToLabelItems, buildAliasAssignmentPreview, labelItemForAsset } from "@/lib/label-aliases";
import { getCalibrationTestPack } from "@/lib/label-calibration";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function LabelPrintPage({ searchParams }: Props) {
  if (!(await hasPagePermission("labels.print"))) return <ForbiddenPanel message="Printing labels requires Auditor, IT Staff, or Admin access." />;
  const query = await searchParams;
  const mode = query.mode === "range" || query.mode === "manual" || query.mode === "alias-linked" || query.mode === "batch" || query.mode === "calibration" ? query.mode : "existing";
  const options = normalizeLabelOptions(query);
  const items = await labelsForPrint(mode, query);
  const isBatch = mode === "batch";

  return (
    <main className="min-h-screen bg-white p-4 text-slate-950 print:p-0">
      <style>{`
        @media print {
          body { background: white; }
          nav, header, .no-print { display: none !important; }
          .label-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .batch-label-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
          .label-card { break-inside: avoid; box-shadow: none !important; }
        }
      `}</style>
      <div className="no-print mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h1 className="font-semibold">Printable Labels</h1>
        <p className="mt-1 text-sm text-slate-600">Use your browser print dialog for PDF or paper output. Visible text is printed; encoded value is scanned.</p>
      </div>
      <section className={`label-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${isBatch ? "batch-label-grid" : ""}`}>
        {await Promise.all(items.map((item) => (
          <div key={item.assetTag} className="label-card">
            {isBatch ? <BatchPrintLabel item={item} options={options} /> : <LabelPreviewCard item={item} options={options} compact />}
          </div>
        )))}
      </section>
    </main>
  );
}

async function labelsForPrint(mode: LabelMode | "alias-linked" | "calibration", query: Record<string, string | undefined>): Promise<LabelItem[]> {
  if (mode === "range") {
    return generateRangeLabels({
      prefix: query.prefix || "",
      start: Number(query.start || "1"),
      end: Number(query.end || "1"),
      padding: Number(query.padding || "0"),
    }).slice(0, 500);
  }

  if (mode === "manual") return parseManualLabelList(query.manual || "").slice(0, 500);

  if (mode === "batch") {
    return generateBatchPatternLabels({
      visibleTemplate: query.visibleTemplate || "K{num}",
      encodedTemplate: query.encodedTemplate || query.visibleTemplate || "K{num}",
      start: Number(query.start || "1"),
      end: Number(query.end || "24"),
      padding: Number(query.padding || "2"),
      maxCount: 1000,
    });
  }

  if (mode === "calibration") return getCalibrationTestPack(query.pack).items;

  if (mode === "alias-linked") {
    const selectedIds = String(query.deviceIds || "").split(",").filter(Boolean);
    const [assets, existingAliases] = await Promise.all([
      prisma.device.findMany({
        where: { id: { in: selectedIds } },
        select: { id: true, name: true, assetTag: true, serialNumber: true, aliases: { select: { aliasType: true, value: true } } },
        orderBy: [{ name: "asc" }],
      }),
      prisma.deviceAlias.findMany({ select: { deviceId: true, aliasType: true, value: true } }),
    ]);
    const orderedAssets = selectedIds.flatMap((id) => assets.find((asset) => asset.id === id) ?? []);
    const preview = buildAliasAssignmentPreview(orderedAssets, {
      prefix: query.prefix || "",
      start: Number(query.start || "1"),
      end: Number(query.end || "1"),
      padding: Number(query.padding || "0"),
      aliasType: query.aliasType || "PHYSICAL_LABEL",
    }, existingAliases);
    return preview.ok ? aliasPreviewToLabelItems(preview.rows) : [];
  }

  const tags = query.tags?.trim();
  if (tags) {
    const requested = parseLabelTagList(tags).slice(0, 500);
    const requestedTags = requested.map((item) => item.assetTag);
    const devices = await prisma.device.findMany({
      where: { assetTag: { in: requestedTags } },
      select: { id: true, name: true, assetTag: true, serialNumber: true, aliases: { select: { aliasType: true, value: true } } },
    });
    return requested.map((requestedItem) => {
      const device = devices.find((asset) => asset.assetTag?.toLowerCase() === requestedItem.assetTag.toLowerCase());
      if (!device) return requestedItem;
      return labelItemForAsset(device) ?? requestedItem;
    });
  }

  const q = query.q?.trim();
  const devices = await prisma.device.findMany({
    where: {
      ...(query.deviceId ? { id: query.deviceId } : {}),
      ...(q
        ? {
            OR: [
              { assetTag: { contains: q } },
              { serialNumber: { contains: q } },
              { name: { contains: q } },
              { model: { contains: q } },
              { aliases: { some: { value: { contains: q } } } },
            ],
          }
        : {}),
      ...(query.category ? { category: query.category as never } : {}),
      ...(query.status ? { status: query.status as never } : {}),
      assetTag: { not: null },
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    select: { id: true, name: true, assetTag: true, serialNumber: true, aliases: { select: { aliasType: true, value: true } } },
    take: 500,
  });

  return devices.flatMap((device) => {
    const item = labelItemForAsset(device, { usePhysicalLabel: query.useAlias === "true" });
    if (!item || !validateLabelPayload(item.assetTag).ok) return [];
    return [item];
  });
}

function BatchPrintLabel({ item, options }: { item: LabelItem; options: Required<LabelOptions> }) {
  const payload = buildLabelPayload(item, options);
  if (!payload.ok) return <div className="rounded border border-rose-200 p-2 text-xs text-rose-800">{payload.message}</div>;
  const codeType = options.codeType;
  const showBarcode = codeType === "barcode" || codeType === "qr_barcode";
  const showMatrix = codeType === "data_matrix";
  const showQr = codeType === "qr" || codeType === "qr_barcode";
  return (
    <article className="min-h-28 rounded border border-slate-300 bg-white p-2">
      <p className="break-all text-center font-mono text-lg font-bold leading-tight text-slate-950">{payload.visibleText}</p>
      <div className="mt-1 flex items-center justify-center gap-2">
        {showQr ? <CodePlaceholder label="QR" value={payload.primary} /> : null}
        {showMatrix ? <CodePlaceholder label="DM" value={payload.primary} /> : null}
        {showBarcode ? <MiniBarcode value={payload.primary} /> : null}
      </div>
      {payload.visibleText !== payload.primary ? <p className="mt-1 break-all text-center font-mono text-[10px] text-slate-600">Scan: {payload.primary}</p> : null}
    </article>
  );
}

function CodePlaceholder({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex size-14 items-center justify-center border border-slate-950 text-[10px] font-bold text-slate-950">
      <span>{label}</span>
      <span className="sr-only">{value}</span>
    </div>
  );
}

function MiniBarcode({ value }: { value: string }) {
  return (
    <div className="flex h-12 max-w-24 items-stretch overflow-hidden border-x border-slate-950">
      {barcodeBars(value).slice(0, 42).map((bar, index) => (
        <span key={index} className={bar.on ? "bg-slate-950" : "bg-white"} style={{ width: `${Math.max(1, bar.width)}px` }} />
      ))}
    </div>
  );
}
