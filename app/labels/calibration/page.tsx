import Link from "next/link";
import { Download, Printer, ScanLine, Tags } from "lucide-react";
import { LabelPreviewCard } from "@/components/label-preview";
import { LabelCalibrationScanTest } from "@/components/label-calibration-scan-test";
import { PageHeader } from "@/components/page-header";
import { ActionLink, PageActions } from "@/components/ui-patterns";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import {
  calibrationExpectedOutputs,
  calibrationPackOptions,
  calibrationPacks,
  calibrationSettingsFromQuery,
  getCalibrationTestPack,
  type CalibrationPackType,
} from "@/lib/label-calibration";
import { normalizeLabelOptions, type LabelCodeType, type LabelTemplate } from "@/lib/labels";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const dpiOptions = [
  ["203", "203 dpi"],
  ["300", "300 dpi"],
] as const;

const sizeOptions = [
  ["micro-25x10", "Micro 25mm x 10mm"],
  ["micro-30x10", "Micro 30mm x 10mm"],
  ["small-25x12", "Small 25mm x 12mm"],
  ["standard-40x20", "Standard 40mm x 20mm"],
  ["standard-50x25", "Standard 50mm x 25mm"],
  ["batch-sheet", "Batch sheet"],
] as const;

const codeTypeOptions: Array<[LabelCodeType, string]> = [
  ["data_matrix", "Data Matrix"],
  ["qr", "QR"],
  ["barcode", "Code 128"],
  ["qr_barcode", "QR + Code 128"],
];

const templateOptions: Array<[LabelTemplate, string]> = [
  ["micro_device", "Micro device"],
  ["scanner_sled", "Scanner / sled"],
  ["batch_sheet", "Batch sheet"],
  ["compact", "Compact"],
  ["standard", "Standard"],
  ["large", "Large"],
];

const scaleOptions = [
  ["small", "Small"],
  ["medium", "Medium"],
  ["large", "Large"],
] as const;

export default async function LabelCalibrationPage({ searchParams }: Props) {
  if (!(await hasPagePermission("labels.print"))) return <ForbiddenPanel message="Label calibration requires Auditor, IT Staff, or Admin access." />;
  const query = await searchParams;
  const settings = calibrationSettingsFromQuery(query);
  const pack = getCalibrationTestPack(settings.pack);
  const options = normalizeLabelOptions({
    codeType: settings.codeType,
    template: settings.template,
    includeSerialText: "false",
    includeSerialCode: "false",
  });
  const expected = calibrationExpectedOutputs(pack.items);
  const params = calibrationParams(settings);
  const printHref = `/labels/print?${params}`;
  const zplHref = `/api/labels/zpl?${params}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Label Calibration"
        description="Generate small Zebra test packs, print sample labels, and verify scanner output before production label runs."
        action={
          <PageActions>
            <ActionLink href="/labels">
              <Tags size={16} />
              Label Generator
            </ActionLink>
            <ActionLink href="/scan">
              <ScanLine size={16} />
              Quick Scan
            </ActionLink>
          </PageActions>
        }
      />

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">Calibration is sample-only.</p>
        <p className="mt-1">These packs do not create asset aliases, do not modify inventory, and use only safe test lookup codes. Never print BitLocker keys, passwords, employee names, facturas, private notes, or credentials on labels.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {calibrationPackOptions.map((packType) => {
          const item = calibrationPacks[packType];
          const active = item.type === settings.pack;
          return (
            <Link
              key={item.type}
              href={`/labels/calibration?${calibrationParams({ ...settings, pack: item.type, codeType: item.defaultCodeType, template: item.defaultTemplate, sizePreset: item.defaultSizePreset })}`}
              className={`rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950"}`}
            >
              <p className="font-semibold">{item.title}</p>
              <p className={`mt-2 text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>{item.items.length} sample labels</p>
              <p className={`mt-2 text-sm ${active ? "text-slate-200" : "text-slate-600"}`}>{item.description}</p>
            </Link>
          );
        })}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{pack.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{pack.recommendedUse}</p>
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

        <form className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input type="hidden" name="pack" value={settings.pack} />
          <SelectField label="Printer DPI" name="dpi" value={settings.dpi} options={dpiOptions} />
          <SelectField label="Label size" name="sizePreset" value={settings.sizePreset} options={sizeOptions} />
          <SelectField label="Code type" name="codeType" value={settings.codeType} options={codeTypeOptions} />
          <SelectField label="Template" name="template" value={settings.template} options={templateOptions} />
          <SelectField label="Code size" name="codeSize" value={settings.codeSize} options={scaleOptions} />
          <SelectField label="Text size" name="textSize" value={settings.textSize} options={scaleOptions} />
          <button className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white md:col-span-3 xl:col-span-6">Update calibration preview</button>
        </form>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-950">Printer darkness / density</p>
          <p className="mt-1">This app does not force Zebra darkness globally. Adjust density in the Zebra driver or printer tools during real testing, then keep the best setting with your printer profile.</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Preview first labels</h2>
            <p className="text-sm text-slate-500">Showing all {pack.items.length} test labels. Test packs are intentionally small.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {await Promise.all(pack.items.slice(0, 10).map((item) => <LabelPreviewCard key={`${item.visibleText}-${item.encodedValue}`} item={item} options={options} />))}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Expected scanner output</h2>
            <div className="mt-3 grid gap-2">
              {expected.map((item) => (
                <div key={`${item.visibleText}-${item.expectedScan}`} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-mono font-semibold text-slate-950">Visible: {item.visibleText}</p>
                  <p className="mt-1 break-all font-mono text-slate-600">Expected scanner output: {item.expectedScan}</p>
                  {item.differs ? <p className="mt-1 text-xs font-semibold text-amber-700">Visible text differs from encoded value.</p> : null}
                </div>
              ))}
            </div>
          </section>
          <LabelCalibrationScanTest expectedValues={expected.map((item) => item.expectedScan)} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Print and scan checklist</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            "Can phone camera scan it?",
            "Can Zebra scanner scan it?",
            "Does scanner output expected encoded value?",
            "Does visible text match the intended label?",
            "Is the code too small?",
            "Is text readable?",
            "Does label fit the physical device?",
            "Does adhesive and placement work?",
          ].map((item) => (
            <label key={item} className="flex min-h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="size-4" />
              {item}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function SelectField<T extends string>({ label, name, value, options }: { label: string; name: string; value: T; options: readonly (readonly [T, string])[] }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {label}
      <select name={name} defaultValue={value} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base sm:text-sm">
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function calibrationParams(settings: {
  pack: CalibrationPackType;
  dpi?: string;
  sizePreset?: string;
  codeType?: string;
  template?: string;
  codeSize?: string;
  textSize?: string;
}) {
  const params = new URLSearchParams({
    mode: "calibration",
    pack: settings.pack,
    dpi: settings.dpi ?? "203",
    sizePreset: settings.sizePreset ?? "micro-25x10",
    codeType: settings.codeType ?? "data_matrix",
    template: settings.template ?? "micro_device",
    codeSize: settings.codeSize ?? "medium",
    textSize: settings.textSize ?? "medium",
  });
  return params.toString();
}
