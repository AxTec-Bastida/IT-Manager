"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Employee, StockItem, TemporaryBorrower } from "@prisma/client";
import { Camera, PackageCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/badge";
import { CameraScanner } from "@/components/camera-scanner";
import { stockCategoryLabels, stockIssueTypeLabels } from "@/lib/constants";
import { ScanAutocomplete } from "@/components/scan-autocomplete";

type EmployeeWithIssues = Employee & { stockIssues?: Array<{ id: string; stockItem: { name: string }; quantity: number; returnedQuantity: number; expectedReturnAt: string | Date | null }> };
type BorrowerWithIssues = TemporaryBorrower & { stockIssues?: Array<{ id: string; stockItem: { name: string }; quantity: number; returnedQuantity: number; expectedReturnAt: string | Date | null }> };

type Props = {
  employees: EmployeeWithIssues[];
  temporaryBorrowers: BorrowerWithIssues[];
  stockItems: StockItem[];
  initialEmployeeId?: string;
  initialTemporaryBorrowerId?: string;
  initialStockItemId?: string;
  initialIssueType?: "HANDOUT" | "LOAN";
};

type ScanMode = "borrower" | "stock";

export function StockIssueWorkflow({ employees, temporaryBorrowers, stockItems, initialEmployeeId = "", initialTemporaryBorrowerId = "", initialStockItemId = "", initialIssueType = "HANDOUT" }: Props) {
  const router = useRouter();
  const [borrowerKind, setBorrowerKind] = useState<"employee" | "temporary">(initialTemporaryBorrowerId ? "temporary" : "employee");
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [temporaryBorrowerId, setTemporaryBorrowerId] = useState(initialTemporaryBorrowerId);
  const [stockItemId, setStockItemId] = useState(initialStockItemId);
  const [issueType, setIssueType] = useState<"HANDOUT" | "LOAN">(initialIssueType);
  const [quantity, setQuantity] = useState(1);
  const [scannerMode, setScannerMode] = useState<ScanMode | null>(null);
  const [manualBorrower, setManualBorrower] = useState("");
  const [manualStock, setManualStock] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedEmployee = employees.find((employee) => employee.id === employeeId) ?? null;
  const selectedTemporaryBorrower = temporaryBorrowers.find((borrower) => borrower.id === temporaryBorrowerId) ?? null;
  const selectedStockItem = stockItems.find((item) => item.id === stockItemId) ?? null;
  const canSubmit = Boolean(selectedStockItem && (selectedEmployee || selectedTemporaryBorrower) && quantity > 0 && quantity <= (selectedStockItem?.quantityOnHand ?? 0));

  const lowStockAfterIssue = useMemo(() => {
    if (!selectedStockItem) return false;
    return selectedStockItem.quantityOnHand - quantity <= selectedStockItem.minimumQuantity;
  }, [quantity, selectedStockItem]);

  async function lookup(value: string, mode: ScanMode) {
    const text = value.trim();
    if (!text) return;
    setMessage("Looking up scanned value...");
    const response = await fetch("/api/scan-lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: text }),
    });
    const data = await response.json();
    if (mode === "borrower") {
      const employee = data.employees?.[0] as Employee | undefined;
      const borrower = data.temporaryBorrowers?.[0] as TemporaryBorrower | undefined;
      if (employee) {
        setBorrowerKind("employee");
        setEmployeeId(employee.id);
        setTemporaryBorrowerId("");
        setMessage(`Borrower selected: ${employee.fullName}.`);
      } else if (borrower) {
        setBorrowerKind("temporary");
        setTemporaryBorrowerId(borrower.id);
        setEmployeeId("");
        setMessage(`Temporary borrower selected: ${borrower.name}.`);
      } else {
        setManualBorrower(text);
        setMessage("No borrower found. Create a temporary borrower or search again.");
      }
    } else {
      const stockItem = data.stockItems?.[0] as StockItem | undefined;
      if (stockItem) {
        setStockItemId(stockItem.id);
        setMessage(`Stock selected: ${stockItem.name}.`);
      } else {
        setManualStock(text);
        setMessage("No stock item found. Search stock or create a stock item first.");
      }
    }
    setScannerMode(null);
  }

  async function onSubmit(formData: FormData) {
    if (!selectedStockItem) return;
    setSaving(true);
    setMessage(null);
    const payload = {
      stockItemId,
      quantity,
      issueType,
      employeeId: borrowerKind === "employee" ? employeeId : "",
      temporaryBorrowerId: borrowerKind === "temporary" ? temporaryBorrowerId : "",
      issuedBy: formData.get("issuedBy"),
      issuedAt: formData.get("issuedAt"),
      expectedReturnAt: issueType === "LOAN" ? formData.get("expectedReturnAt") : "",
      conditionOut: formData.get("conditionOut"),
      notes: formData.get("notes"),
    };
    const response = await fetch("/api/stock/issues", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to issue stock.");
      return;
    }
    router.push(`/stock/issues/${data.issue.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">1. Scan or select borrower</h2>
            <p className="mt-1 text-sm text-slate-500">Employee ID, employee name, temp ID, or temporary borrower name.</p>
          </div>
          <button type="button" onClick={() => setScannerMode("borrower")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
            <Camera size={16} />
            Scan borrower
          </button>
        </div>
        <ScanAutocomplete
          show={["employees", "temporaryBorrowers"]}
          placeholder="Type employee name, ID, or temp borrower..."
          inputClassName="min-h-14 text-base"
          className="mt-4"
          onSelect={(s) => {
            if (s.kind === "employee") {
              setBorrowerKind("employee");
              setEmployeeId(s.id);
              setTemporaryBorrowerId("");
              setMessage(`Borrower selected: ${s.fullName}.`);
            } else if (s.kind === "temporary") {
              setBorrowerKind("temporary");
              setTemporaryBorrowerId(s.id);
              setEmployeeId("");
              setMessage(`Temp borrower selected: ${s.name}.`);
            }
          }}
          onSubmit={(value) => lookup(value, "borrower")}
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Borrower type
            <select className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" value={borrowerKind} onChange={(event) => setBorrowerKind(event.target.value as "employee" | "temporary")}>
              <option value="employee">Employee</option>
              <option value="temporary">Temporary borrower</option>
            </select>
          </label>
          {borrowerKind === "employee" ? (
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Employee
              <select className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                <option value="">Select employee</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} {employee.employeeId ? `(${employee.employeeId})` : ""}</option>)}
              </select>
            </label>
          ) : (
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Temporary borrower
              <select className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" value={temporaryBorrowerId} onChange={(event) => setTemporaryBorrowerId(event.target.value)}>
                <option value="">Select temporary borrower</option>
                {temporaryBorrowers.map((borrower) => <option key={borrower.id} value={borrower.id}>{borrower.name} ({borrower.tempId})</option>)}
              </select>
            </label>
          )}
        </div>
        {manualBorrower ? (
          <Link href={`/temporary-borrowers/new?name=${encodeURIComponent(manualBorrower)}`} className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <UserPlus size={16} />
            Create temporary borrower
          </Link>
        ) : null}
        {selectedEmployee || selectedTemporaryBorrower ? <BorrowerCard employee={selectedEmployee} borrower={selectedTemporaryBorrower} /> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">2. Scan or select stock</h2>
            <p className="mt-1 text-sm text-slate-500">Scan codes can match stock scan code, SKU, or item name.</p>
          </div>
          <button type="button" onClick={() => setScannerMode("stock")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
            <Camera size={16} />
            Scan stock
          </button>
        </div>
        <ScanAutocomplete
          show={["devices"]}
          placeholder="Type stock item name, SKU, or scan barcode..."
          inputClassName="min-h-14 text-base"
          className="mt-4"
          onSelect={(s) => {
            if (s.kind === "device") {
              setStockItemId(s.id);
              setMessage(`Stock selected: ${s.name}.`);
            }
          }}
          onSubmit={(value) => lookup(value, "stock")}
        />
        <label className="mt-4 block space-y-1 text-sm font-medium text-slate-700">
          Stock item
          <select className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" value={stockItemId} onChange={(event) => setStockItemId(event.target.value)}>
            <option value="">Select stock item</option>
            {stockItems.map((item) => <option key={item.id} value={item.id}>{item.name} {item.sku ? `(${item.sku})` : ""} - {item.quantityOnHand} on hand</option>)}
          </select>
        </label>
        {manualStock ? (
          <Link href={`/stock?q=${encodeURIComponent(manualStock)}`} className="mt-3 inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Search stock for {manualStock}
          </Link>
        ) : null}
        {selectedStockItem ? <StockCard item={selectedStockItem} quantity={quantity} lowAfter={lowStockAfterIssue} /> : null}
      </section>

      <form action={onSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">3. Confirm issue</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Issue type
            <select className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" value={issueType} onChange={(event) => setIssueType(event.target.value as "HANDOUT" | "LOAN")}>
              <option value="HANDOUT">{stockIssueTypeLabels.HANDOUT}</option>
              <option value="LOAN">{stockIssueTypeLabels.LOAN}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Quantity
            <input className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" type="number" min="1" max={selectedStockItem?.quantityOnHand ?? 1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Issued by
            <input className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" name="issuedBy" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Issued date
            <input className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" name="issuedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </label>
          {issueType === "LOAN" ? (
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Expected return date
              <input className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" name="expectedReturnAt" type="date" />
            </label>
          ) : null}
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Condition out
            <input className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" name="conditionOut" placeholder="Good, new, used, missing box" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
            Notes
            <textarea className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base" name="notes" />
          </label>
        </div>
        {message ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}
        <button className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto" disabled={saving || !canSubmit}>
          <PackageCheck size={18} />
          {saving ? "Saving..." : issueType === "LOAN" ? "Loan stock" : "Hand out stock"}
        </button>
        {selectedStockItem && quantity > selectedStockItem.quantityOnHand ? <p className="mt-2 text-sm text-rose-700">Requested quantity exceeds stock on hand.</p> : null}
      </form>

      {scannerMode ? <CameraScanner title={scannerMode === "borrower" ? "Scan borrower" : "Scan stock item"} onDetected={(value) => lookup(value, scannerMode)} onClose={() => setScannerMode(null)} /> : null}
    </div>
  );
}

function BorrowerCard({ employee, borrower }: { employee: EmployeeWithIssues | null; borrower: BorrowerWithIssues | null }) {
  const activeIssues = employee?.stockIssues ?? borrower?.stockIssues ?? [];
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="text-xs font-medium uppercase text-slate-500">Selected borrower</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{employee?.fullName || borrower?.name}</p>
      <p className="text-slate-600">{employee?.employeeId || borrower?.tempId || "No ID"} / {employee?.department || borrower?.department || borrower?.area || "No department"}</p>
      <p className="mt-2 text-slate-600">{activeIssues.length} active stock loan{activeIssues.length === 1 ? "" : "s"}.</p>
    </div>
  );
}

function StockCard({ item, quantity, lowAfter }: { item: StockItem; quantity: number; lowAfter: boolean }) {
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">Selected stock</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{item.name}</p>
          <p className="text-slate-600">{item.sku || item.barcodeValue || "No code"} / {stockCategoryLabels[item.category]}</p>
        </div>
        {item.quantityOnHand <= item.minimumQuantity ? <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Low</Badge> : <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">OK</Badge>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-white p-3"><span className="text-slate-500">On hand</span><p className="text-lg font-semibold">{item.quantityOnHand}</p></div>
        <div className="rounded-md bg-white p-3"><span className="text-slate-500">After issue</span><p className="text-lg font-semibold">{Math.max(0, item.quantityOnHand - quantity)}</p></div>
      </div>
      {lowAfter ? <p className="mt-2 text-amber-800">This issue will leave the item at or below minimum stock.</p> : null}
    </div>
  );
}
