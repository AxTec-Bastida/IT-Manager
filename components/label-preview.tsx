import Image from "next/image";
import { barcodeBars, buildLabelPayload, officialAssetTagText, qrDataUrl, type LabelCodeType, type LabelItem, type LabelOptions } from "@/lib/labels";

type Props = {
  item: LabelItem;
  options?: LabelOptions;
  compact?: boolean;
};

export async function LabelPreviewCard({ item, options = {}, compact = false }: Props) {
  const payload = buildLabelPayload(item, options);
  const codeType: LabelCodeType = options.codeType ?? "qr_barcode";

  if (!payload.ok) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <p className="font-semibold">{item.assetTag || "Invalid label"}</p>
        <p className="mt-1">{payload.message}</p>
      </div>
    );
  }

  const showQr = codeType === "qr" || codeType === "qr_barcode";
  const showBarcode = codeType === "barcode" || codeType === "qr_barcode";
  const showDataMatrix = codeType === "data_matrix";
  const qr = showQr ? await qrDataUrl(payload.primary, compact ? 116 : 150) : null;
  const serialQr = payload.serialCode ? await qrDataUrl(payload.serialCode, 88) : null;
  const officialAssetTag = officialAssetTagText(item);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-semibold text-slate-950">{item.assetName || payload.visibleText}</p>
          <p className="font-mono text-sm text-slate-600">{payload.visibleText}</p>
          {item.matchNote ? <p className="mt-1 text-xs font-semibold text-slate-500">{item.matchNote}</p> : null}
          {item.existsInInventory === false ? <p className="mt-1 text-xs font-semibold text-amber-700">Not found in inventory yet</p> : null}
        </div>
      </div>

      <div className={`mt-3 grid gap-3 ${compact ? "" : "sm:grid-cols-[auto_1fr]"}`}>
          {qr ? (
            <div className="w-fit rounded-md border border-slate-200 bg-white p-2">
            <Image src={qr} alt={`QR code for ${payload.primary}`} width={compact ? 116 : 150} height={compact ? 116 : 150} unoptimized />
          </div>
        ) : null}
        {showDataMatrix ? <DataMatrixPreview value={payload.primary} compact={compact} /> : null}
        <div className="min-w-0 space-y-3">
          {showBarcode ? <BarcodePreview value={payload.primary} /> : null}
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase text-slate-500">Visible label text</p>
            <p className="mt-1 break-words font-mono text-sm font-semibold text-slate-950">{payload.visibleText}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase text-slate-500">Encoded scan value</p>
            <p className="mt-1 break-words font-mono text-sm font-semibold text-slate-950">{payload.primary}</p>
          </div>
          {officialAssetTag ? (
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase text-slate-500">Official asset tag</p>
              <p className="mt-1 break-words font-mono text-sm text-slate-800">{officialAssetTag}</p>
            </div>
          ) : null}
          {payload.serialText ? (
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase text-slate-500">Serial text only</p>
              <p className="mt-1 break-words font-mono text-sm text-slate-800">{payload.serialText}</p>
            </div>
          ) : null}
        </div>
      </div>

      {serialQr ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Separate serial code</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Image src={serialQr} alt={`Serial QR code for ${item.serialNumber}`} width={88} height={88} unoptimized />
            <p className="break-words font-mono text-sm text-slate-800">{payload.serialCode}</p>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function DataMatrixPreview({ value, compact }: { value: string; compact: boolean }) {
  return (
    <div className="w-fit rounded-md border border-slate-200 bg-white p-2">
      <div className={`grid ${compact ? "size-[116px]" : "size-[150px]"} grid-cols-8 grid-rows-8 overflow-hidden border border-slate-950 bg-white`}>
        {Array.from({ length: 64 }, (_, index) => {
          const on = index % 2 === 0 || index % 7 === 0 || value.charCodeAt(index % value.length) % 3 === 0;
          return <span key={index} className={on ? "bg-slate-950" : "bg-white"} />;
        })}
      </div>
      <p className="mt-1 text-center text-[10px] font-semibold uppercase text-slate-500">Data Matrix preview</p>
    </div>
  );
}

function BarcodePreview({ value }: { value: string }) {
  const bars = barcodeBars(value);

  return (
    <div className="max-w-full overflow-hidden rounded-md border border-slate-200 bg-white p-2">
      <div className="flex h-12 items-stretch overflow-hidden">
        {bars.map((bar, index) => (
          <span key={`${index}-${bar.width}-${bar.on ? "1" : "0"}`} className={bar.on ? "bg-slate-950" : "bg-white"} style={{ width: `${bar.width}px` }} />
        ))}
      </div>
      <p className="mt-1 truncate text-center font-mono text-[11px] text-slate-600">{value}</p>
    </div>
  );
}
