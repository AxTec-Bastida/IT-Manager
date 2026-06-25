import Link from "next/link";
import { Download, Plus, Printer, Search, Tags, Box, ClipboardList, Layers, FileSpreadsheet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ActionLink, EmptyState, PageActions } from "@/components/ui-patterns";
import { LabelPreviewCard } from "@/components/label-preview";
import { AliasLabelApplyButton } from "@/components/alias-label-apply-button";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { categoryLabels, categoryOptions, statusLabels, statusOptions } from "@/lib/constants";
import { generateBatchPatternLabels, generateRangeLabels, normalizeLabelOptions, parseManualLabelList, validateLabelPayload, type LabelItem, type LabelMode } from "@/lib/labels";
import { aliasPreviewToLabelItems, buildAliasAssignmentPreview, labelItemForAsset } from "@/lib/label-aliases";
import { hasPagePermission } from "@/lib/page-permissions";
import { RangeForm, BatchForm } from "@/components/label-range-form";
import { StockLabelForm } from "@/components/stock-label-selector";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function LabelsPage({ searchParams }: Props) {
  if (!(await hasPagePermission("labels.print"))) {
    return <ForbiddenPanel message="Label preview and printing requires Auditor, IT Staff, or Admin access." />;
  }

  const query = await searchParams;
  const currentMode = query.mode; // Could be undefined for guided hub

  if (!currentMode) {
    return <GuidedHubPage />;
  }

  const mode = normalizeMode(currentMode);
  const options = normalizeLabelOptions(query);
  const existingPage = Math.max(1, Number(query.page || "1"));
  const pageSize = 50;

  const { items, total, error } = await loadPreviewItems(mode, query, existingPage, pageSize);
  const previewItems = items.slice(0, 10);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Determine all active stock items for stock label form
  const stockItems = mode === "stock" ? await prisma.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [];

  const zplHref = `/api/labels/zpl?${hrefParams(query, { mode })}`;
  const printHref = `/labels/print?${hrefParams(query, { mode })}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Label Generator"
        description="Create QR, Data Matrix, and barcode labels for asset lookup. Printed text and scanned payloads stay separate when needed."
        action={
          <PageActions>
            <ActionLink href="/labels/calibration">
              <Printer size={16} />
              Calibration
            </ActionLink>
            <ActionLink href="/labels" variant="secondary">
              <Layers size={16} />
              Modes Menu
            </ActionLink>
            <ActionLink href="/intake/assets/new" variant="primary">
              <Plus size={16} />
              Add asset
            </ActionLink>
          </PageActions>
        }
      />

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">Label safety</p>
        <p className="mt-1">The main QR/barcode encodes only the asset tag or stock code. Serial can be added as a separate secondary code. Do not encode passwords, BitLocker keys, employee names, private notes, facturas, or credentials.</p>
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <ModeLink mode="existing" current={mode}>Existing assets</ModeLink>
        <ModeLink mode="stock" current={mode}>Stock items</ModeLink>
        <ModeLink mode="range" current={mode}>Range / pattern</ModeLink>
        <ModeLink mode="batch" current={mode}>Batch sheet</ModeLink>
        <ModeLink mode="manual" current={mode}>Manual list</ModeLink>
        <ModeLink mode="alias-linked" current={mode}>Alias-linked labels</ModeLink>
      </nav>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {mode === "existing" ? <ExistingAssetsForm query={query} page={existingPage} totalPages={totalPages} /> : null}
        {mode === "stock" ? <StockLabelForm stockItems={stockItems} initialStockItemId={query.stockItemId} /> : null}
        {mode === "range" ? <RangeForm initialValues={query} /> : null}
        {mode === "batch" ? <BatchForm initialValues={query} /> : null}
        {mode === "manual" ? <ManualForm query={query} /> : null}
        {mode === "alias-linked" ? <AliasLinkedForm query={query} page={existingPage} totalPages={totalPages} /> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-950 font-sans">Output options</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-4">
          <input type="hidden" name="mode" value={mode} />
          {preserveModeInputs(query, mode)}
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Code type
            <select name="codeType" defaultValue={options.codeType} className="min-h-12 rounded-md border border-slate-300 px-3 bg-white text-base sm:text-sm">
              <option value="qr_barcode">QR + Barcode</option>
              <option value="qr">QR only</option>
              <option value="data_matrix">Data Matrix</option>
              <option value="barcode">Barcode only</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Template size preset
            <select name="template" defaultValue={options.template ?? (mode === "stock" ? "stock_shelf" : "standard")} className="min-h-12 rounded-md border border-slate-300 px-3 bg-white text-base sm:text-sm">
              <option value="compact">Compact (2&quot; x 1&quot;)</option>
              <option value="standard">Standard (3&quot; x 2&quot;)</option>
              <option value="large">Large (4&quot; x 2&quot;)</option>
              <option value="micro_device">Micro device (1&quot; x 0.5&quot;)</option>
              <option value="scanner_sled">Scanner / sled (2&quot; x 1.2&quot;)</option>
              <option value="2x2">2x2 Square (Best for small boxes/QR)</option>
              <option value="4x6">4x6 Large (Shipping style / detailed)</option>
              <option value="small_asset">Small asset tag (Laptop/sled tag)</option>
              <option value="stock_shelf">Stock shelf label (Consumable bins)</option>
              <option value="sheet_labels">Sheet labels (Office printer sheets)</option>
            </select>
          </label>
          <input type="hidden" name="includeSerialText" value="false" />
          <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 md:mt-6">
            <input type="checkbox" name="includeSerialText" value="true" defaultChecked={options.includeSerialText} />
            Show serial text
          </label>
          <input type="hidden" name="includeSerialCode" value="false" />
          <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 md:mt-6">
            <input type="checkbox" name="includeSerialCode" value="true" defaultChecked={options.includeSerialCode} />
            Separate serial code
          </label>
          <button className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white md:col-span-4 hover:bg-slate-800">Update preview</button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950 font-sans">Preview</h2>
            <p className="text-sm text-slate-500">Showing first {previewItems.length} of {total}. Export or print all matching labels when ready.</p>
          </div>
          <div className="grid gap-2 sm:flex">
            <Link href={zplHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <Download size={16} />
              Download ZPL
            </Link>
            <Link href={printHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <Printer size={16} />
              Print view
            </Link>
          </div>
        </div>
        
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error}</div> : null}
        
        {!error && mode === "batch" && items.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Free batch labels are not linked to inventory yet.</p>
            <p className="mt-1">They will scan to their encoded values, but they will not open assets until those values exist as asset tags or aliases.</p>
          </div>
        ) : null}
        
        {!error && mode === "existing" && items.length ? <ExistingSelectionForm items={items} query={query} /> : null}
        {!error && mode === "alias-linked" && items.length ? <AliasLinkedActions items={items} query={query} /> : null}
        
        {!error && previewItems.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {await Promise.all(previewItems.map((item) => <LabelPreviewCard key={item.assetTag} item={item} options={options} />))}
          </div>
        ) : !error ? (
          <EmptyState title="No labels to preview" description="Search assets, select stock items, enter a range, or paste a manual list to generate labels." />
        ) : null}
      </section>
    </div>
  );
}

function GuidedHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Label Generator"
        description="Choose what type of labels you want to configure and print today."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <GuidedHubCard
          href="/labels?mode=existing"
          title="Existing Assets"
          description="Print labels for devices already registered in inventory. Search by category, name, or serial number."
          bestFor="Laptops, printers, scales, or access points currently in warehouse cages."
          icon={Tags}
        />
        <GuidedHubCard
          href="/labels?mode=stock"
          title="Stock Items"
          description="Print labels for quantity-tracked consumables, peripherals, adapters, or chargers."
          bestFor="Bin labels, shelf markings, cable containers, or printer supply shelves."
          icon={Box}
        />
        <GuidedHubCard
          href="/labels?mode=range"
          title="Range / Pattern"
          description="Generate a sequential list of barcodes (e.g., GHT-LP-01 to GHT-LP-50). Configures prefix, start, end, and explicit padding."
          bestFor="Pre-printing label sheets for upcoming intake batches or bin ranges."
          icon={Layers}
        />
        <GuidedHubCard
          href="/labels?mode=batch"
          title="Batch Sheet"
          description="Generate labels from visible and encoded templates. Supports custom pattern strings like Zebra-K{num}."
          bestFor="Complex batch receiving sheets where scanning values differ from printed tags."
          icon={FileSpreadsheet}
        />
        <GuidedHubCard
          href="/labels?mode=manual"
          title="Manual List"
          description="Paste or type a list of custom asset tags (one per line) to preview and print instantly."
          bestFor="Printing replacement tags for a custom, ad-hoc list of devices."
          icon={ClipboardList}
        />
        <GuidedHubCard
          href="/labels?mode=alias-linked"
          title="Alias-linked / Paired Labels"
          description="Link generated physical codes (e.g. J01, J02) to existing inventory assets as aliases."
          bestFor="Pairing sleds with iPods/iPhones where secondary tags are required."
          icon={Tags}
        />
      </div>
    </div>
  );
}

function GuidedHubCard({
  href,
  title,
  description,
  bestFor,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  bestFor: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <Link href={href} className="flex flex-col h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg p-2.5 bg-slate-950 text-white">
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-950 text-sm">{title}</h3>
          <p className="mt-1 text-xs text-slate-600 leading-normal">{description}</p>
        </div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
        <strong>Best for:</strong> {bestFor}
      </div>
      <div className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-800 mt-auto">
        Configure
      </div>
    </Link>
  );
}

function normalizeMode(value?: string): LabelMode {
  return value === "range" || value === "manual" || value === "alias-linked" || value === "batch" || value === "stock" ? value : "existing";
}

async function loadPreviewItems(mode: LabelMode, query: Record<string, string | undefined>, page: number, pageSize: number): Promise<{ items: LabelItem[]; total: number; error?: string }> {
  try {
    if (mode === "range") {
      const items = generateRangeLabels({
        prefix: query.prefix || "J",
        start: Number(query.start || "1"),
        end: Number(query.end || "10"),
        padding: Number(query.padding || "2"),
      });
      return { items, total: items.length };
    }

    if (mode === "batch") {
      const items = generateBatchPatternLabels({
        visibleTemplate: query.visibleTemplate || "K{num}",
        encodedTemplate: query.encodedTemplate || query.visibleTemplate || "K{num}",
        start: Number(query.start || "1"),
        end: Number(query.end || "24"),
        padding: Number(query.padding || "2"),
        maxCount: 1000,
      });
      return { items, total: items.length };
    }

    if (mode === "manual") {
      const items = parseManualLabelList(query.manual || "");
      return { items, total: items.length };
    }

    if (mode === "stock") {
      const stockItemId = query.stockItemId;
      const q = query.q?.trim();
      const where = {
        active: true,
        ...(stockItemId ? { id: stockItemId } : {}),
        ...(q ? {
          OR: [
            { name: { contains: q } },
            { barcodeValue: { contains: q } },
            { sku: { contains: q } }
          ]
        } : {})
      };
      const [total, stockItems] = await Promise.all([
        prisma.stockItem.count({ where }),
        prisma.stockItem.findMany({
          where,
          orderBy: { name: "asc" },
          take: pageSize,
        })
      ]);
      return {
        total,
        items: stockItems.map((item) => ({
          assetTag: item.barcodeValue || item.sku || `STK-${item.id.slice(0, 8)}`,
          visibleText: item.name,
          encodedValue: item.barcodeValue || item.sku || `STK-${item.id}`,
          serialNumber: item.sku || null,
          assetName: `${item.name}${item.storageLocation ? ` (${item.storageLocation})` : ""}`,
          existsInInventory: true,
          matchNote: `Stock shelf label`
        })),
      };
    }

    if (mode === "alias-linked") {
      const q = query.q?.trim();
      const where = {
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
      };
      const [total, devices, existingAliases] = await Promise.all([
        prisma.device.count({ where }),
        prisma.device.findMany({
          where,
          orderBy: [{ name: "asc" }],
          select: { id: true, name: true, assetTag: true, serialNumber: true, aliases: { select: { aliasType: true, value: true } } },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.deviceAlias.findMany({ select: { deviceId: true, aliasType: true, value: true } }),
      ]);
      const start = Number(query.start || "1");
      const end = query.end ? Number(query.end) : start + devices.length - 1;
      const preview = buildAliasAssignmentPreview(
        devices,
        { prefix: query.prefix || "J", start, end, padding: Number(query.padding || "2"), aliasType: query.aliasType || "PHYSICAL_LABEL" },
        existingAliases,
      );
      return { items: aliasPreviewToLabelItems(preview.rows), total, error: preview.ok ? undefined : preview.message };
    }

    const q = query.q?.trim();
    const where = {
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
    };
    const [total, devices] = await Promise.all([
      prisma.device.count({ where }),
      prisma.device.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
        select: { id: true, name: true, assetTag: true, serialNumber: true, category: true, status: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      items: devices.flatMap((device) => {
        if (!device.assetTag || !validateLabelPayload(device.assetTag).ok) return [];
        const item = labelItemForAsset(device, { usePhysicalLabel: query.useAlias === "true" });
        return item ? [item] : [{ deviceId: device.id, assetTag: device.assetTag, serialNumber: device.serialNumber, assetName: device.name, existsInInventory: true }];
      }),
    };
  } catch (error) {
    return { items: [], total: 0, error: error instanceof Error ? error.message : "Could not build label preview." };
  }
}

function AliasLinkedForm({ query, page, totalPages }: { query: Record<string, string | undefined>; page: number; totalPages: number }) {
  return (
    <form className="space-y-3">
      <input type="hidden" name="mode" value="alias-linked" />
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        Linked labels encode the generated physical code, such as J01, and store it as a DeviceAlias. Free range labels are not linked until applied here.
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-4 text-slate-400" size={16} />
          <input name="q" defaultValue={query.q ?? ""} placeholder="Search assets to link labels" className="min-h-14 w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-base sm:min-h-12 sm:text-sm" />
        </label>
        <button className="min-h-14 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white sm:min-h-12">Find assets</button>
        <Link href="/labels?mode=alias-linked" className="inline-flex min-h-14 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12">Clear</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-6">
        <select name="category" defaultValue={query.category ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 bg-white text-base sm:text-sm">
          <option value="">All categories</option>
          {categoryOptions.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
        </select>
        <select name="status" defaultValue={query.status ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 bg-white text-base sm:text-sm">
          <option value="">All statuses</option>
          {statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </select>
        <input name="prefix" defaultValue={query.prefix ?? "J"} placeholder="Prefix" className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        <input name="start" type="number" defaultValue={query.start ?? "1"} placeholder="Start" className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        <input name="end" type="number" defaultValue={query.end ?? ""} placeholder="End (auto)" className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        <input name="padding" type="number" defaultValue={query.padding ?? "2"} placeholder="Padding" className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        <select name="aliasType" defaultValue={query.aliasType ?? "PHYSICAL_LABEL"} className="min-h-12 rounded-md border border-slate-300 px-3 bg-white text-base sm:text-sm">
          <option value="PHYSICAL_LABEL">Physical label</option>
          <option value="SCAN_CODE">Scan code</option>
        </select>
        <div className="flex gap-2 md:col-span-2">
          <PageButton disabled={page <= 1} href={`/labels?${hrefParams(query, { mode: "alias-linked", page: String(page - 1) })}`}>Previous</PageButton>
          <PageButton disabled={page >= totalPages} href={`/labels?${hrefParams(query, { mode: "alias-linked", page: String(page + 1) })}`}>Next</PageButton>
        </div>
      </div>
    </form>
  );
}

function AliasLinkedActions({ items, query }: { items: LabelItem[]; query: Record<string, string | undefined> }) {
  const deviceIds = items.map((item) => item.deviceId).filter((id): id is string => Boolean(id));
  const start = Number(query.start || "1");
  const end = query.end ? Number(query.end) : start + deviceIds.length - 1;
  const params = hrefParams(query, { mode: "alias-linked", deviceIds: deviceIds.join(","), start: String(start), end: String(end), prefix: query.prefix || "J", padding: query.padding || "2" });
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-emerald-950">Alias-linked label actions</h3>
          <p className="mt-1 text-sm text-emerald-900">Preview maps {deviceIds.length} current-page asset(s) to generated physical label codes.</p>
        </div>
        <div className="grid gap-2 sm:flex">
          <Link href={`/api/labels/zpl?${params}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Download linked ZPL</Link>
          <Link href={`/labels/print?${params}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800">Print linked labels</Link>
        </div>
      </div>
      <div className="mt-3">
        <AliasLabelApplyButton deviceIds={deviceIds} prefix={query.prefix || "J"} start={start} end={end} padding={Number(query.padding || "2")} aliasType={query.aliasType || "PHYSICAL_LABEL"} />
      </div>
    </section>
  );
}

function ExistingSelectionForm({ items, query }: { items: LabelItem[]; query: Record<string, string | undefined> }) {
  const options = normalizeLabelOptions(query);
  return (
    <details className="rounded-lg border border-slate-200 bg-white" open>
      <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
        Select assets on this page
      </summary>
      <form action="/api/labels/zpl" className="grid gap-3 border-t border-slate-200 p-4">
        <input type="hidden" name="mode" value="existing" />
        <input type="hidden" name="codeType" value={options.codeType} />
        <input type="hidden" name="template" value={options.template} />
        <input type="hidden" name="includeSerialText" value={String(options.includeSerialText)} />
        <input type="hidden" name="includeSerialCode" value={String(options.includeSerialCode)} />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <label key={item.deviceId ?? item.assetTag} className="flex min-h-14 items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <input type="checkbox" name="deviceId" value={item.deviceId} defaultChecked className="mt-1" disabled={!item.deviceId} />
              <span className="min-w-0">
                <span className="block break-words font-semibold text-slate-950">{item.assetName || item.assetTag}</span>
                <span className="block break-all font-mono text-xs text-slate-600">{item.assetTag}</span>
              </span>
            </label>
          ))}
        </div>
        <button className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Download selected current page ZPL</button>
      </form>
    </details>
  );
}

function ExistingAssetsForm({ query, page, totalPages }: { query: Record<string, string | undefined>; page: number; totalPages: number }) {
  return (
    <form className="space-y-3">
      <input type="hidden" name="mode" value="existing" />
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-4 text-slate-400" size={16} />
          <input name="q" defaultValue={query.q ?? ""} placeholder="Search tag, serial, model, asset name, alias" className="min-h-14 w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-base sm:min-h-12 sm:text-sm" />
        </label>
        <button className="min-h-14 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white sm:min-h-12">Search assets</button>
        <Link href="/labels?mode=existing" className="inline-flex min-h-14 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12">Clear</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <select name="category" defaultValue={query.category ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 bg-white text-base sm:text-sm">
          <option value="">All categories</option>
          {categoryOptions.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
        </select>
        <select name="status" defaultValue={query.status ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 bg-white text-base sm:text-sm">
          <option value="">All statuses</option>
          {statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </select>
        <div className="flex gap-2">
          <PageButton disabled={page <= 1} href={`/labels?${hrefParams(query, { mode: "existing", page: String(page - 1) })}`}>Previous</PageButton>
          <PageButton disabled={page >= totalPages} href={`/labels?${hrefParams(query, { mode: "existing", page: String(page + 1) })}`}>Next</PageButton>
        </div>
      </div>
      <p className="text-sm text-slate-500">Select individual assets by opening this page with search/filter, or export the current filtered set. Preview is limited so phones stay fast.</p>
    </form>
  );
}

function ManualForm({ query }: { query: Record<string, string | undefined> }) {
  return (
    <form className="space-y-3">
      <input type="hidden" name="mode" value="manual" />
      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        One asset tag per line
        <textarea name="manual" defaultValue={query.manual ?? "GHT-LP-011\nZebra-208"} rows={6} className="w-full rounded-md border border-slate-300 p-3 font-mono text-base sm:text-sm" />
      </label>
      <button className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Preview manual list</button>
    </form>
  );
}

function ModeLink({ mode, current, children }: { mode: LabelMode; current: LabelMode; children: React.ReactNode }) {
  return (
    <Link href={`/labels?mode=${mode}`} className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${mode === current ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>
      {children}
    </Link>
  );
}

function PageButton({ disabled, href, children }: { disabled: boolean; href: string; children: React.ReactNode }) {
  if (disabled) return <span className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-400">{children}</span>;
  return <Link href={href} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">{children}</Link>;
}

function hrefParams(current: Record<string, string | undefined>, next: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...next })) {
    if (value) params.set(key, value);
  }
  if (current.includeSerialText === undefined && next.includeSerialText === undefined) params.set("includeSerialText", "true");
  return params.toString();
}

function preserveModeInputs(query: Record<string, string | undefined>, mode: LabelMode) {
  const keys = mode === "range" ? ["prefix", "start", "end", "padding"] : mode === "batch" ? ["visibleTemplate", "encodedTemplate", "start", "end", "padding"] : mode === "manual" ? ["manual"] : mode === "stock" ? ["stockItemId"] : mode === "alias-linked" ? ["q", "category", "status", "prefix", "start", "end", "padding", "aliasType", "page"] : ["q", "category", "status", "deviceId", "page"];
  return keys.map((key) => (query[key] ? <input key={key} type="hidden" name={key} value={query[key]} /> : null));
}
