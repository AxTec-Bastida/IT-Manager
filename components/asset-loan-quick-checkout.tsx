"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Package, PackageCheck, RotateCcw, Search, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/badge";
import { categoryLabels, conditionLabels, statusLabels, statusTone } from "@/lib/constants";
import { canAddQuickCheckoutAsset, expectedReturnDate, hasAssignedAssetWarning, quickCheckoutAssetWarning } from "@/lib/quick-checkout";
import { chipButtonClass } from "@/lib/ui-classes";

type Borrower =
  | {
      kind: "employee";
      id: string;
      name: string;
      label: string;
      department?: string | null;
      openHref: string;
      activeAssetLoans?: number;
      activeStockLoans?: number;
    }
  | {
      kind: "temporary";
      id: string;
      name: string;
      label: string;
      department?: string | null;
      openHref: string;
      activeAssetLoans?: number;
      activeStockLoans?: number;
    };

type QuickAsset = {
  id: string;
  name: string;
  assetTag: string | null;
  serialNumber: string | null;
  model: string | null;
  category: string;
  status: string;
  condition: string;
  assignedTo: string | null;
  employeeId?: string | null;
  employee?: { fullName: string } | null;
  aliases?: Array<{ aliasType: string; value: string }>;
  rmaItems?: unknown[];
  assetLoanItems?: unknown[];
  matchedAlias?: string | null;
};

type QuickStockSuggestion = {
  id: string;
  name: string;
  sku: string | null;
  barcodeValue?: string | null;
  itemType: string;
  category?: string;
  quantityOnHand: number;
  minimumQuantity: number;
  storageLocation: string | null;
};

type Props = {
  initialBorrower?: Borrower | null;
  initialAssets?: QuickAsset[];
};

export function AssetLoanQuickCheckout({ initialBorrower = null, initialAssets = [] }: Props) {
  const router = useRouter();
  const [scanValue, setScanValue] = useState("");
  const [borrower, setBorrower] = useState<Borrower | null>(initialBorrower);
  const [assets, setAssets] = useState<QuickAsset[]>(initialAssets);
  const [expectedReturnAt, setExpectedReturnAt] = useState(expectedReturnDate(3));
  const [quickDueDays, setQuickDueDays] = useState(3);
  const [customDate, setCustomDate] = useState(false);
  const [allowAssigned, setAllowAssigned] = useState(false);
  const [message, setMessage] = useState<string | null>(initialAssets.length && !initialBorrower ? "Asset selected. Scan borrower." : initialBorrower && !initialAssets.length ? "Borrower selected. Scan asset." : null);
  const [error, setError] = useState<string | null>(null);
  const [stockSuggestions, setStockSuggestions] = useState<QuickStockSuggestion[]>([]);
  const [serializedSuggestions, setSerializedSuggestions] = useState<QuickAsset[]>([]);
  const [stockWorkflowQuery, setStockWorkflowQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const assignedWarning = hasAssignedAssetWarning(assets);
  const eligibleAssets = assets.filter((asset) => !quickCheckoutAssetWarning(asset));
  const canCreate = Boolean(borrower && eligibleAssets.length && (!assignedWarning || allowAssigned));

  const prompt = useMemo(() => {
    if (!borrower && !assets.length) return "Scan employee, temp borrower, or asset.";
    if (!borrower) return "Asset selected. Scan borrower.";
    if (!assets.length) return "Borrower selected. Scan asset.";
    return "Ready to confirm checkout.";
  }, [assets.length, borrower]);

  async function scan(value: string) {
    const text = value.trim();
    if (!text) return;
    setError(null);
    setStockSuggestions([]);
    setSerializedSuggestions([]);
    setStockWorkflowQuery("");
    setMessage("Looking up scanned value...");
    const response = await fetch("/api/scan-lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: text }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Scan lookup failed.");
      setMessage(null);
      return;
    }
    const employees = data.employees ?? [];
    const temps = data.temporaryBorrowers ?? [];
    const devices = data.devices ?? [];
    const stockItems = data.stockItems ?? [];
    const workflowRecommendation = data.workflowRecommendation;

    if (employees.length === 1 && !borrower) {
      setBorrower(employeeToBorrower(employees[0]));
      setMessage("Employee selected. Scan asset.");
      setScanValue("");
      return;
    }
    if (temps.length === 1 && !borrower) {
      setBorrower(temporaryToBorrower(temps[0]));
      setMessage("Temporary borrower selected. Scan asset.");
      setScanValue("");
      return;
    }
    if (workflowRecommendation?.preferred === "STOCK_ITEM" && !workflowRecommendation?.hasExactSerializedAssetMatch) {
      setStockSuggestions(stockItems);
      setSerializedSuggestions(devices.map((device: QuickAsset) => normalizeAsset(device, text)));
      setStockWorkflowQuery(text);
      setMessage("This looks like a stock/peripheral item. Use Issue / Loan Item instead.");
      setScanValue("");
      if (!stockItems.length) setError(`No stock item found for ${text}. Add it to stock or search serialized assets manually.`);
      return;
    }
    if (devices.length >= 1) {
      const device = normalizeAsset(devices[0], text);
      const result = canAddQuickCheckoutAsset(device, assets.map((asset) => asset.id));
      if (!result.ok) {
        setError(result.message);
        setMessage(null);
        return;
      }
      setAssets((current) => [...current, device]);
      setMessage(borrower ? "Asset added. Scan another asset or create the loan." : "Asset selected. Scan borrower.");
      setScanValue("");
      return;
    }
    if (employees.length === 1) {
      setBorrower(employeeToBorrower(employees[0]));
      setMessage("Employee selected.");
      setScanValue("");
      return;
    }
    if (temps.length === 1) {
      setBorrower(temporaryToBorrower(temps[0]));
      setMessage("Temporary borrower selected.");
      setScanValue("");
      return;
    }

    const possible = employees.length + temps.length + devices.length + stockItems.length;
    if (possible > 1) {
      setError("Multiple matches found. Add a little more text, use an exact tag/ID, or use the manual search fallback.");
    } else {
      setError("No borrower or serialized asset found.");
    }
    setMessage(null);
  }

  async function createLoan() {
    if (!borrower) {
      setError("Scan or select a borrower first.");
      return;
    }
    if (!assets.length) {
      setError("Scan at least one asset.");
      return;
    }
    if (assignedWarning && !allowAssigned) {
      setError("Confirm assigned asset warning before checkout.");
      return;
    }
    setSaving(true);
    setError(null);
    const response = await fetch("/api/loans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        employeeId: borrower.kind === "employee" ? borrower.id : "",
        temporaryBorrowerId: borrower.kind === "temporary" ? borrower.id : "",
        expectedReturnAt,
        loanStartAt: new Date().toISOString().slice(0, 10),
        checkoutNotes: "Created from quick checkout.",
        termsAccepted: false,
        allowAssigned,
        assetIds: assets.map((asset) => asset.id),
        conditionOut: assets[0]?.condition || "GOOD",
      }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Unable to create asset loan.");
      return;
    }
    router.push(`/loans/${data.loan.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-5 pb-32">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-slate-500">Quick checkout</p>
          <h2 className="text-lg font-semibold text-slate-950">{prompt}</h2>
        </div>
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            scan(scanValue);
          }}
        >
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-4 text-slate-400" size={18} />
            <input
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              className="min-h-16 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-base"
              placeholder="Scan employee, temp borrower, or asset"
              autoFocus
            />
          </label>
          <button className="inline-flex min-h-16 items-center justify-center rounded-lg bg-slate-950 px-5 font-semibold text-white hover:bg-slate-800">Scan / Add</button>
        </form>
        {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-900">{message}</p> : null}
        {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</p> : null}
        {stockWorkflowQuery ? <StockWorkflowSuggestionPanel query={stockWorkflowQuery} stockItems={stockSuggestions} serializedAssets={serializedSuggestions} borrower={borrower} /> : null}
        <details className="mt-3 rounded-md border border-slate-200 bg-slate-50">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-slate-700">Manual fallback</summary>
          <div className="grid gap-2 border-t border-slate-200 p-3 sm:flex">
            <Link href="/loans/new" className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">Advanced form</Link>
            <Link href="/devices" className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">Search assets</Link>
            <Link href="/temporary-borrowers/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><UserPlus size={15} />Create temporary borrower</Link>
          </div>
        </details>
      </section>

      {borrower ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-800">{borrower.label}</p>
              <h2 className="text-xl font-semibold text-slate-950">{borrower.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{borrower.department || "No department/area"}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-white p-3"><span className="text-slate-500">Asset loans</span><p className="font-semibold">{borrower.activeAssetLoans ?? 0}</p></div>
                <div className="rounded-md bg-white p-3"><span className="text-slate-500">Stock loans</span><p className="font-semibold">{borrower.activeStockLoans ?? 0}</p></div>
              </div>
            </div>
            <div className="grid gap-2 sm:min-w-40">
              <Link href={borrower.openHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-900"><ExternalLink size={15} />Open</Link>
              <button type="button" onClick={() => setBorrower(null)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-900"><RotateCcw size={15} />Change</button>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No borrower selected yet. Scan an employee ID/name/email or a temporary borrower ID/name.</section>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-950">Selected assets</h2>
          <p className="text-sm text-slate-500">Scan more serialized assets to add them to this same loan.</p>
        </div>
        {assets.map((asset) => {
          const block = quickCheckoutAssetWarning(asset);
          const assigned = asset.employee?.fullName || asset.assignedTo;
          return (
            <article key={asset.id} className={`rounded-lg border bg-white p-4 ${block ? "border-rose-200" : assigned ? "border-amber-200" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-950">{asset.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{asset.assetTag || "No tag"} / {asset.serialNumber || "No serial"}</p>
                  <p className="mt-1 text-sm text-slate-500">{asset.model || "No model"}</p>
                  {asset.matchedAlias ? <p className="mt-2 rounded-md bg-sky-50 p-2 text-sm font-medium text-sky-900">Matched legacy alias: {asset.matchedAlias}</p> : null}
                </div>
                <button type="button" onClick={() => setAssets((current) => current.filter((item) => item.id !== asset.id))} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-300 text-slate-700">
                  <X size={17} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className={statusTone[asset.status as keyof typeof statusTone]}>{statusLabels[asset.status as keyof typeof statusLabels] ?? asset.status.replaceAll("_", " ")}</Badge>
                <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{conditionLabels[asset.condition as keyof typeof conditionLabels] ?? asset.condition.replaceAll("_", " ")}</Badge>
                <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{categoryLabels[asset.category as keyof typeof categoryLabels] ?? asset.category}</Badge>
              </div>
              {assigned ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-900">Assigned to {assigned}. Loaning temporarily may conflict with current responsibility.</p> : null}
              {block ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-medium text-rose-800">{block}</p> : null}
              <div className="mt-3">
                <Link href={`/devices/${asset.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700"><ExternalLink size={15} />Open asset</Link>
              </div>
            </article>
          );
        })}
        {!assets.length ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No assets selected yet.</div> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Expected return</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button type="button" aria-pressed={!customDate && quickDueDays === 1} onClick={() => { setExpectedReturnAt(expectedReturnDate(1)); setQuickDueDays(1); setCustomDate(false); }} className={chipButtonClass(!customDate && quickDueDays === 1)}>Tomorrow</button>
          <button type="button" aria-pressed={!customDate && quickDueDays === 3} onClick={() => { setExpectedReturnAt(expectedReturnDate(3)); setQuickDueDays(3); setCustomDate(false); }} className={chipButtonClass(!customDate && quickDueDays === 3)}>3 days</button>
          <button type="button" aria-pressed={!customDate && quickDueDays === 7} onClick={() => { setExpectedReturnAt(expectedReturnDate(7)); setQuickDueDays(7); setCustomDate(false); }} className={chipButtonClass(!customDate && quickDueDays === 7)}>1 week</button>
        </div>
        <button type="button" aria-pressed={customDate} onClick={() => setCustomDate((value) => !value)} className={`mt-2 w-full ${chipButtonClass(customDate)}`}>Custom date</button>
        {customDate ? <input type="date" value={expectedReturnAt} onChange={(event) => { setExpectedReturnAt(event.target.value); setQuickDueDays(0); }} className="mt-2 min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" /> : null}
        <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">Due date: <span className="font-semibold text-slate-950">{expectedReturnAt}</span></p>
      </section>

      {assignedWarning ? (
        <label className="flex min-h-14 items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
          <input type="checkbox" checked={allowAssigned} onChange={(event) => setAllowAssigned(event.target.checked)} className="mt-1 size-5" />
          Confirm assigned asset warning. Assignment history will be preserved and no assignment will be cleared.
        </label>
      ) : null}

      <div className="fixed inset-x-0 bottom-20 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto grid max-w-5xl gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
            <div className="rounded-md bg-slate-50 p-2"><span>Borrower</span><p className="font-semibold text-slate-950">{borrower ? "Ready" : "Missing"}</p></div>
            <div className="rounded-md bg-slate-50 p-2"><span>Assets</span><p className="font-semibold text-slate-950">{eligibleAssets.length}</p></div>
            <div className="rounded-md bg-slate-50 p-2"><span>Due</span><p className="font-semibold text-slate-950">{expectedReturnAt.slice(5)}</p></div>
          </div>
          <button type="button" disabled={!canCreate || saving} onClick={createLoan} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300">
            <CheckCircle2 size={18} />
            {saving ? "Creating..." : "Create Loan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function employeeToBorrower(employee: { id: string; fullName: string; employeeId?: string | null; department?: string | null; stockIssues?: unknown[]; assetLoans?: unknown[] }): Borrower {
  return {
    kind: "employee",
    id: employee.id,
    name: employee.fullName,
    label: employee.employeeId ? `Employee ${employee.employeeId}` : "Employee",
    department: employee.department,
    openHref: `/employees/${employee.id}`,
    activeAssetLoans: employee.assetLoans?.length ?? 0,
    activeStockLoans: employee.stockIssues?.length ?? 0,
  };
}

function temporaryToBorrower(borrower: { id: string; tempId: string; name: string; department?: string | null; area?: string | null; stockIssues?: unknown[]; assetLoans?: unknown[] }): Borrower {
  return {
    kind: "temporary",
    id: borrower.id,
    name: borrower.name,
    label: `Temporary ${borrower.tempId}`,
    department: borrower.department || borrower.area,
    openHref: `/temporary-borrowers/${borrower.id}`,
    activeAssetLoans: borrower.assetLoans?.length ?? 0,
    activeStockLoans: borrower.stockIssues?.length ?? 0,
  };
}

function StockWorkflowSuggestionPanel({ query, stockItems, serializedAssets, borrower }: { query: string; stockItems: QuickStockSuggestion[]; serializedAssets: QuickAsset[]; borrower: Borrower | null }) {
  const primaryStock = stockItems[0] ?? null;
  return (
    <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
      <p className="font-semibold">This looks like a stock/peripheral item.</p>
      <p className="mt-1">Asset Loans are for serialized equipment. For generic items like mice, keyboards, chargers, cables, and headsets, use Issue / Loan Item.</p>
      {primaryStock ? (
        <div className="mt-3 rounded-md bg-white p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Stock item suggestion</p>
          <h3 className="mt-1 font-semibold text-slate-950">{primaryStock.name}</h3>
          <p className="text-slate-600">{primaryStock.sku || primaryStock.barcodeValue || "No SKU"} / {primaryStock.quantityOnHand} on hand / {primaryStock.storageLocation || "No location"}</p>
        </div>
      ) : (
        <div className="mt-3 rounded-md bg-white p-3">
          <p className="font-semibold text-slate-950">No stock item found for {query}.</p>
          <p className="text-slate-600">Create a stock item first, or search serialized assets manually if this is actually a tagged device.</p>
        </div>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {primaryStock ? (
          <>
            <Link href={stockIssueHref(primaryStock.id, borrower, "HANDOUT")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 font-semibold text-white hover:bg-slate-800">
              <PackageCheck size={17} />
              Issue / Loan Item
            </Link>
            <Link href={stockIssueHref(primaryStock.id, borrower, "LOAN")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-sky-300 bg-white px-3 font-semibold text-sky-900 hover:bg-sky-100">
              <RotateCcw size={17} />
              Create Stock Loan
            </Link>
            <Link href={`/stock/${primaryStock.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-sky-300 bg-white px-3 font-semibold text-sky-900 hover:bg-sky-100">
              <Package size={17} />
              Open Stock Item
            </Link>
          </>
        ) : (
          <Link href={`/stock/new?name=${encodeURIComponent(query)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 font-semibold text-white hover:bg-slate-800">
            <PackageCheck size={17} />
            Add Stock Item
          </Link>
        )}
        <Link href={`/devices?q=${encodeURIComponent(query)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-100">
          <Search size={17} />
          Search serialized assets anyway
        </Link>
      </div>
      {serializedAssets.length ? (
        <details className="mt-3 rounded-md border border-sky-200 bg-white">
          <summary className="min-h-11 cursor-pointer px-3 py-3 font-semibold text-sky-950">Show serialized loose matches</summary>
          <div className="grid gap-2 border-t border-sky-100 p-3">
            {serializedAssets.slice(0, 5).map((asset) => (
              <Link key={asset.id} href={`/devices/${asset.id}`} className="rounded-md border border-slate-200 p-3 text-slate-700 hover:bg-slate-50">
                <span className="block font-semibold text-slate-950">{asset.name}</span>
                <span className="block text-xs">{asset.assetTag || "No tag"} / {asset.serialNumber || "No serial"} / {asset.category.replaceAll("_", " ")}</span>
              </Link>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function stockIssueHref(stockItemId: string, borrower: Borrower | null, issueType: "HANDOUT" | "LOAN") {
  const params = new URLSearchParams({ stockItemId });
  if (issueType === "LOAN") params.set("issueType", "LOAN");
  if (borrower?.kind === "employee") params.set("employeeId", borrower.id);
  if (borrower?.kind === "temporary") params.set("temporaryBorrowerId", borrower.id);
  return `/stock/issue?${params.toString()}`;
}

function normalizeAsset(device: QuickAsset, scannedValue?: string): QuickAsset {
  const normalizedScan = scannedValue?.trim().toLowerCase();
  const matchedAlias = normalizedScan ? device.aliases?.find((alias) => alias.value.toLowerCase() === normalizedScan || alias.value.toLowerCase().includes(normalizedScan))?.value ?? null : null;
  return { ...device, matchedAlias };
}
