"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { AlertTriangle, ArchiveX, Camera, ClipboardList, ExternalLink, ImagePlus, MapPin, Network, Package, PackageCheck, Plus, RotateCcw, Search, TimerReset, Truck, UserPlus, Users, Wrench } from "lucide-react";
import { CameraScanner } from "@/components/camera-scanner";
import { Badge } from "@/components/badge";
import { scanLookupFailureMessage } from "@/lib/camera";
import { categoryLabels, conditionLabels, conditionTone, statusLabels, statusTone } from "@/lib/constants";
import type { ParsedScan } from "@/lib/scan-label";
import { installActionLabel, isInstallEligibleAsset } from "@/lib/equipment-install";
import { isMoveUsefulAsset } from "@/lib/equipment-move";

type LookupDevice = {
  id: string;
  assetTag: string | null;
  name: string;
  ipAddress: string | null;
  macAddress: string | null;
  serialNumber: string | null;
  category: string;
  status: string;
  condition: string;
  location: string | null;
  areaDepartment?: string | null;
  usesStaticIp?: boolean | null;
  isFixedAsset?: boolean | null;
  employee?: { fullName: string } | null;
  assignedTo?: string | null;
  warrantyExpiresAt?: string | null;
  alerts?: Array<{ id: string; title: string; severity: string; source: string; status: string }>;
  assignmentItems?: Array<{
    id: string;
    assignmentId: string;
    returnStatus: string;
    assignment: {
      id: string;
      assignmentNumber: string;
      status: string;
      assignmentDate: string;
      targetName?: string | null;
      targetPath?: string | null;
      targetType?: string | null;
      employee: { id: string; fullName: string; employeeId: string | null; department: string | null } | null;
    };
  }>;
  rmaItems?: Array<{ id: string; result: string; sentAt: string | null; rmaCaseId: string; rmaCase: { id: string; rmaNumber: string; status: string; sentAt: string | null; destination: string; vendorName: string | null } }>;
  assetLoanItems?: Array<{ id: string; loanId: string; returnStatus: string; loan: { id: string; loanNumber: string; status: string; expectedReturnAt: string; employee?: { fullName: string } | null; temporaryBorrower?: { name: string; tempId: string } | null } }>;
  locationHistory?: Array<{ locationLabel: string; seenAt: string; apName: string; apMapLocation?: { locationZone?: { name: string } | null } | null }>;
  aliases?: Array<{ aliasType: string; value: string }>;
};

type LookupStockItem = {
  id: string;
  name: string;
  sku: string | null;
  barcodeValue?: string | null;
  active?: boolean;
  itemType: string;
  category?: string;
  quantityOnHand: number;
  minimumQuantity: number;
  storageLocation: string | null;
};

type LookupEmployee = {
  id: string;
  fullName: string;
  employeeId: string | null;
  department: string | null;
  email: string | null;
  assignedDevices?: Array<{ id: string; name: string; assetTag: string | null }>;
  stockIssues?: Array<{ id: string; quantity: number; returnedQuantity: number; stockItem: { name: string } }>;
  assetLoans?: Array<{ id: string; loanNumber: string; status: string; items: Array<{ id: string }> }>;
};

type LookupTemporaryBorrower = {
  id: string;
  tempId: string;
  name: string;
  department: string | null;
  area: string | null;
  stockIssues?: Array<{ id: string; quantity: number; returnedQuantity: number; stockItem: { name: string } }>;
  assetLoans?: Array<{ id: string; loanNumber: string; status: string; items: Array<{ id: string }> }>;
};

type QuickScanPermissions = {
  inventory?: boolean;
  assignments?: boolean;
  loans?: boolean;
  stock?: boolean;
  rma?: boolean;
  tasks?: boolean;
  audits?: boolean;
};

const defaultQuickScanPermissions: Required<QuickScanPermissions> = {
  inventory: true,
  assignments: true,
  loans: true,
  stock: true,
  rma: true,
  tasks: true,
  audits: true,
};

export function QuickScanPanel({ permissions = defaultQuickScanPermissions }: { permissions?: QuickScanPermissions }) {
  const can = { ...defaultQuickScanPermissions, ...permissions };
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedScan | null>(null);
  const [devices, setDevices] = useState<LookupDevice[]>([]);
  const [stockItems, setStockItems] = useState<LookupStockItem[]>([]);
  const [archivedStockItems, setArchivedStockItems] = useState<LookupStockItem[]>([]);
  const [employees, setEmployees] = useState<LookupEmployee[]>([]);
  const [temporaryBorrowers, setTemporaryBorrowers] = useState<LookupTemporaryBorrower[]>([]);
  const [matchedAliases, setMatchedAliases] = useState<Array<{ deviceId: string; aliasType: string; value: string; label: string; officialAssetTag: string | null }>>([]);
  const [aliasConflicts, setAliasConflicts] = useState<Array<{ value: string; aliases: Array<{ deviceId: string; aliasType: string; value: string; officialAssetTag: string | null }> }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (value: string, options: { closeScanner?: boolean } = {}) => {
    const closeScanner = options.closeScanner ?? true;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/scan-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Scan lookup failed.");
      setParsed(data.parsed);
      setDevices(data.devices ?? []);
      setStockItems(data.stockItems ?? []);
      setArchivedStockItems(data.archivedStockItems ?? []);
      setEmployees(data.employees ?? []);
      setTemporaryBorrowers(data.temporaryBorrowers ?? []);
      setMatchedAliases(data.matchedAliases ?? []);
      setAliasConflicts(data.aliasConflicts ?? []);
      if (closeScanner) setScannerOpen(false);
      const totalMatches = (data.devices ?? []).length + (data.stockItems ?? []).length + (data.archivedStockItems ?? []).length + (data.employees ?? []).length + (data.temporaryBorrowers ?? []).length;
      if (totalMatches === 1) setMessage("One matching record found.");
      if (totalMatches === 0) setMessage("No exact match found. Search inventory, stock, or create a new record with the scanned value.");
    } catch (error) {
      setMessage(scanLookupFailureMessage(error));
      if (closeScanner) setScannerOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  async function markSeen(id: string) {
    await fetch(`/api/devices/${id}/seen`, { method: "POST" });
    setMessage("Asset marked seen just now.");
    router.refresh();
  }

  const addHref = parsed
    ? `/devices/new?${new URLSearchParams({
        ...(parsed.ipAddress ? { ipAddress: parsed.ipAddress } : {}),
        ...(parsed.macAddress ? { macAddress: parsed.macAddress } : {}),
        ...(parsed.serialNumber ? { serialNumber: parsed.serialNumber } : {}),
        ...(parsed.deviceName ? { name: parsed.deviceName } : {}),
        ...(parsed.assetTag ? { assetTag: parsed.assetTag } : {}),
      }).toString()}`
    : "/devices/new";

  return (
    <div className="space-y-5">
      <CameraAccessNotice />
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="flex min-h-20 w-full items-center justify-center gap-3 rounded-lg bg-slate-950 px-4 text-lg font-semibold text-white hover:bg-slate-800"
        >
          <Camera size={26} />
          Start camera scan
        </button>
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const value = String(formData.get("manual") ?? "");
            if (value) lookup(value);
          }}
        >
          <input name="manual" className="min-h-14 rounded-md border border-slate-300 px-3 text-base" placeholder="Type, paste, or scan with handheld scanner" />
          <button className="min-h-14 rounded-md border border-slate-300 px-5 text-base font-semibold text-slate-700 hover:bg-slate-100">Search</button>
        </form>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </section>

      {parsed ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Scanned value</h2>
          <p className="mt-2 break-all rounded-md bg-slate-50 p-3 font-mono text-sm text-slate-700">{parsed.raw}</p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {parsed.ipAddress ? <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">IP</span><p className="font-mono">{parsed.ipAddress}</p></div> : null}
            {parsed.macAddress ? <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">MAC</span><p className="font-mono">{parsed.macAddress}</p></div> : null}
            {parsed.serialNumber ? <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Serial</span><p>{parsed.serialNumber}</p></div> : null}
            {parsed.assetTag ? <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Asset tag</span><p>{parsed.assetTag}</p></div> : null}
            {parsed.deviceName ? <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Name</span><p>{parsed.deviceName}</p></div> : null}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link href={`/devices?q=${encodeURIComponent(parsed.query)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12">
              <Search size={18} />
              Search assets
            </Link>
            {can.stock ? <Link href={`/stock?q=${encodeURIComponent(parsed.query)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12">
              <Package size={18} />
              Search stock
            </Link> : null}
            {can.inventory ? <Link href={addHref} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 sm:min-h-12">
              <Plus size={18} />
              Add asset
            </Link> : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {loading ? <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Looking up inventory and stock...</div> : null}
        {aliasConflicts.length ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
            <p className="font-semibold">Alias conflict found</p>
            <p className="mt-1">This scan code matches more than one asset alias. Open Data Quality or review aliases before using this code operationally.</p>
            {aliasConflicts.map((conflict) => (
              <p key={conflict.value} className="mt-2 font-mono">{conflict.value}: {conflict.aliases.length} assets</p>
            ))}
          </div>
        ) : null}
        {devices.map((device) => {
          const activeAssignment = device.assignmentItems?.[0]?.assignment;
          const matchedAlias = matchedAliases.find((alias) => alias.deviceId === device.id);
          const decommissionedStatus = ["RETIRED", "DISPOSED", "LOST"].includes(device.status);
          return (
          <article key={device.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-slate-500">Serialized asset</p>
            <h2 className="font-semibold text-slate-950">{device.name}</h2>
            <p className="font-mono text-sm text-slate-600">{device.assetTag || device.ipAddress || device.serialNumber || "No tag"}</p>
            {matchedAlias ? (
              <p className="mt-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                Matched by {matchedAlias.label}: {matchedAlias.value} / official tag {matchedAlias.officialAssetTag || "not set"}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className={statusTone[device.status as keyof typeof statusTone]}>{statusLabels[device.status as keyof typeof statusLabels] ?? device.status.replaceAll("_", " ")}</Badge>
              <Badge className={conditionTone[device.condition as keyof typeof conditionTone]}>{conditionLabels[device.condition as keyof typeof conditionLabels] ?? device.condition.replaceAll("_", " ")}</Badge>
              <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{categoryLabels[device.category as keyof typeof categoryLabels] ?? device.category}</Badge>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-3">
                <span className="text-slate-500">Location</span>
                <p className="font-medium text-slate-950">{device.location || "No location"}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <span className="text-slate-500">Assigned</span>
                <p className="font-medium text-slate-950">{device.employee?.fullName || device.assignedTo || "Unassigned"}</p>
              </div>
              {device.ipAddress ? (
                <div className="rounded-md bg-slate-50 p-3">
                  <span className="text-slate-500">IP</span>
                  <p className="font-mono font-medium text-slate-950">{device.ipAddress}</p>
                </div>
              ) : null}
              {device.macAddress ? (
                <div className="rounded-md bg-slate-50 p-3">
                  <span className="text-slate-500">MAC</span>
                  <p className="break-all font-mono font-medium text-slate-950">{device.macAddress}</p>
                </div>
              ) : null}
              {device.locationHistory?.[0] ? (
                <div className="rounded-md bg-slate-50 p-3 sm:col-span-2">
                  <span className="text-slate-500">Last seen location</span>
                  <p className="font-medium text-slate-950">{device.locationHistory[0].apMapLocation?.locationZone?.name || device.locationHistory[0].locationLabel}</p>
                </div>
              ) : null}
            </div>
          </div>
            </div>
            {device.alerts?.length ? (
              <div className="mt-3 space-y-2">
                {device.alerts.map((alert) => (
                  <Link key={alert.id} href={`/alerts?assetId=${device.id}`} className="flex min-h-12 items-center gap-2 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                    <AlertTriangle size={16} />
                    {alert.severity}: {alert.title}
                  </Link>
                ))}
              </div>
            ) : null}
            {decommissionedStatus ? (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
                <p className="font-semibold">This asset is retired/decommissioned.</p>
                <p className="mt-1">Do not issue, assign, or place back in service without review.</p>
                {can.inventory ? (
                  <Link href={`/devices/${device.id}/decommission`} className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-rose-700 px-3 font-semibold text-white hover:bg-rose-800">
                    <ArchiveX size={17} />
                    Open decommission record
                  </Link>
                ) : null}
              </div>
            ) : null}
            {activeAssignment ? (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">Currently assigned on {activeAssignment.assignmentNumber}</p>
                    <p>Responsible: {activeAssignment.targetPath || activeAssignment.targetName || activeAssignment.employee?.fullName || "Unknown target"}</p>
                    <p>Since {dateText(activeAssignment.assignmentDate) || "date not set"}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                  {can.assignments ? <Link href={`/assignments/${activeAssignment.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 font-semibold text-white hover:bg-emerald-800">
                    <ClipboardList size={17} />
                    Open Assignment
                    </Link> : null}
                    {activeAssignment.employee ? <Link href={`/employees/${activeAssignment.employee.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-3 font-semibold text-emerald-800 hover:bg-emerald-100">
                      <Users size={17} />
                      Open Employee
                    </Link> : null}
                  </div>
                </div>
              </div>
            ) : null}
            {device.rmaItems?.[0] ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">In active RMA {device.rmaItems[0].rmaCase.rmaNumber}</p>
                    <p>{device.rmaItems[0].rmaCase.status.replaceAll("_", " ")} / {device.rmaItems[0].result.replaceAll("_", " ")}</p>
                    <p>Sent {dateText(device.rmaItems[0].sentAt || device.rmaItems[0].rmaCase.sentAt) || "date not set"}</p>
                  </div>
                  {can.rma ? <Link href={`/rma/${device.rmaItems[0].rmaCaseId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-amber-700 px-3 font-semibold text-white hover:bg-amber-800">
                    <PackageCheck size={17} />
                    Open RMA
                  </Link> : null}
                </div>
              </div>
            ) : null}
            {device.assetLoanItems?.[0] ? (
              <div className="mt-3 rounded-md border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">Checked out on {device.assetLoanItems[0].loan.loanNumber}</p>
                    <p>{device.assetLoanItems[0].loan.status.replaceAll("_", " ")} / {device.assetLoanItems[0].returnStatus.replaceAll("_", " ")}</p>
                    <p>Due {dateText(device.assetLoanItems[0].loan.expectedReturnAt) || "date not set"}</p>
                  </div>
                  {can.loans ? <Link href={`/loans/${device.assetLoanItems[0].loanId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-violet-700 px-3 font-semibold text-white hover:bg-violet-800">
                    <ClipboardList size={17} />
                    Open Loan
                  </Link> : null}
                </div>
              </div>
            ) : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href={`/devices/${device.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                <ExternalLink size={17} />
                Open Asset
              </Link>
              {can.inventory && isMoveUsefulAsset(device) ? (
                <Link href={`/devices/${device.id}/move`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-sky-700 px-3 text-sm font-semibold text-white hover:bg-sky-800">
                  <Truck size={17} />
                  Move / Relocate
                </Link>
              ) : null}
              {can.inventory && isInstallEligibleAsset(device) ? (
                <Link href={`/devices/${device.id}/install`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800">
                  <Network size={17} />
                  {installActionLabel(device)}
                </Link>
              ) : null}
              {can.assignments && (device.employee?.fullName || device.assignedTo || device.status === "IN_USE_ASSIGNED") ? (
                <Link href={`/devices/${device.id}/return`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800">
                  <RotateCcw size={17} />
                  Return / Unassign
                </Link>
              ) : null}
              {can.inventory ? <button type="button" onClick={() => markSeen(device.id)} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <TimerReset size={17} />
                Mark seen
              </button> : null}
              {can.inventory ? <Link href={`/devices/${device.id}/edit`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <ExternalLink size={17} />
                Edit
              </Link> : null}
              {can.inventory ? <Link href={`/devices/${device.id}#photos`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <ImagePlus size={17} />
                Add Photo
              </Link> : null}
              {can.inventory ? <Link href={`/devices/${device.id}/maintenance/new`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Wrench size={17} />
                Maintenance
              </Link> : null}
              {can.tasks ? <Link href={`/tasks/new?relatedDeviceId=${device.id}&category=INVENTORY&title=${encodeURIComponent(`Follow up ${device.name}`)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Plus size={17} />
                Create Task
              </Link> : null}
              {can.rma && device.rmaItems?.[0] ? (
                <Link href={`/rma/${device.rmaItems[0].rmaCaseId}/receive`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-amber-300 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-50">
                  <RotateCcw size={17} />
                  Receive RMA
                </Link>
              ) : can.rma ? (
                <Link href={`/rma/new?deviceId=${device.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <PackageCheck size={17} />
                  Create RMA
                </Link>
              ) : null}
              {can.loans && device.assetLoanItems?.[0] ? (
                <Link href={`/loans/${device.assetLoanItems[0].loanId}/return`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-violet-300 px-3 text-sm font-semibold text-violet-800 hover:bg-violet-50">
                  <RotateCcw size={17} />
                  Return Loan
                </Link>
              ) : can.loans ? (
                <Link href={`/loans/quick-checkout?assetId=${device.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <ClipboardList size={17} />
                  Quick Loan
                </Link>
              ) : null}
              <Link href={`/alerts?assetId=${device.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <AlertTriangle size={17} />
                Alerts
              </Link>
              <Link href={`/map?asset=${device.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <MapPin size={17} />
                Map
              </Link>
            </div>
          </article>
          );
        })}
        {employees.map((employee) => (
          <article key={employee.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Employee</p>
                <h2 className="font-semibold text-slate-950">{employee.fullName}</h2>
                <p className="text-sm text-slate-600">{employee.employeeId || "No employee ID"} • {employee.department || "No department"}</p>
                {employee.email ? <p className="text-sm text-slate-500">{employee.email}</p> : null}
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">Active</Badge>
            </div>
            <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
              <span className="text-slate-500">Currently assigned assets</span>
              <p className="text-lg font-semibold text-slate-950">{employee.assignedDevices?.length ?? 0}</p>
            </div>
            <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm">
              <span className="text-slate-500">Active stock loans</span>
              <p className="text-lg font-semibold text-slate-950">{employee.stockIssues?.length ?? 0}</p>
            </div>
            <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm">
              <span className="text-slate-500">Active asset loans</span>
              <p className="text-lg font-semibold text-slate-950">{employee.assetLoans?.length ?? 0}</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {can.stock ? <Link href={`/stock/issue?employeeId=${employee.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                <PackageCheck size={17} />
                Issue / Loan Item
              </Link> : null}
              <Link href={`/employees/${employee.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Users size={17} />
                Open Employee
              </Link>
              {can.loans ? <Link href={`/loans/quick-checkout?borrowerType=employee&borrowerId=${employee.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <ClipboardList size={17} />
                Start Asset Loan
              </Link> : null}
              {can.assignments ? <Link href={`/assignments?q=${encodeURIComponent(employee.employeeId || employee.fullName)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Users size={17} />
                View Assigned
              </Link> : null}
              {can.stock ? <Link href={`/stock/issues?q=${encodeURIComponent(employee.employeeId || employee.fullName)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Package size={17} />
                Stock Issues
              </Link> : null}
              {can.assignments ? <Link href={`/assignments/new?employeeId=${employee.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Plus size={17} />
                Assign Asset
              </Link> : null}
            </div>
          </article>
        ))}
        {temporaryBorrowers.map((borrower) => (
          <article key={borrower.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Temporary borrower</p>
                <h2 className="font-semibold text-slate-950">{borrower.name}</h2>
                <p className="text-sm text-slate-600">{borrower.tempId} • {borrower.department || borrower.area || "No department/area"}</p>
              </div>
              <Badge className="bg-sky-100 text-sky-800 ring-sky-200">Temporary</Badge>
            </div>
            <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
              <span className="text-slate-500">Active stock loans</span>
              <p className="text-lg font-semibold text-slate-950">{borrower.stockIssues?.length ?? 0}</p>
            </div>
            <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm">
              <span className="text-slate-500">Active asset loans</span>
              <p className="text-lg font-semibold text-slate-950">{borrower.assetLoans?.length ?? 0}</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {can.stock ? <Link href={`/stock/issue?temporaryBorrowerId=${borrower.id}&issueType=LOAN`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                <PackageCheck size={17} />
                Issue / Loan Item
              </Link> : null}
              <Link href={`/temporary-borrowers/${borrower.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <UserPlus size={17} />
                Open Borrower
              </Link>
              {can.loans ? <Link href={`/loans/quick-checkout?borrowerType=temporary&borrowerId=${borrower.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <ClipboardList size={17} />
                Start Asset Loan
              </Link> : null}
              {can.stock ? <Link href={`/stock/issues?view=active&q=${encodeURIComponent(borrower.tempId)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <RotateCcw size={17} />
                Return loaned stock
              </Link> : null}
            </div>
          </article>
        ))}
        {stockItems.map((item) => (
          <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Stock item</p>
                <h2 className="font-semibold text-slate-950">{item.name}</h2>
                <p className="font-mono text-sm text-slate-600">{item.barcodeValue || item.sku || "No SKU"}</p>
                <p className="mt-1 text-sm text-slate-500">{item.storageLocation || "No stock location"} - {item.itemType.replaceAll("_", " ")}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-slate-50 p-3">
                <span className="text-slate-500">On hand</span>
                <p className="text-lg font-semibold">{item.quantityOnHand}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <span className="text-slate-500">Minimum</span>
                <p className="text-lg font-semibold">{item.minimumQuantity}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {can.stock ? <Link href={`/stock/issue?stockItemId=${item.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                <PackageCheck size={17} />
                Issue / Loan Item
              </Link> : null}
              {can.stock ? <Link href={`/stock/issue?stockItemId=${item.id}&issueType=LOAN`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <RotateCcw size={17} />
                Loan Stock
              </Link> : null}
              <Link href={`/stock/${item.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                <Package size={17} />
                Open Stock Item
              </Link>
              {can.tasks ? <Link href={`/tasks/new?relatedStockItemId=${item.id}&category=STOCK&title=${encodeURIComponent(`Follow up ${item.name}`)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Plus size={17} />
                Create Task
              </Link> : null}
              {can.stock ? <Link href={`/po-tracker/new?relatedStockItemId=${item.id}&title=${encodeURIComponent(`Order ${item.name}`)}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Package size={17} />
                PO Note
              </Link> : null}
            </div>
          </article>
        ))}
        {archivedStockItems.map((item) => (
          <article key={item.id} className="rounded-lg border border-slate-300 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">{item.name}</h2>
                <p className="font-mono text-sm text-slate-600">{item.barcodeValue || item.sku || "No SKU"}</p>
                <p className="mt-1 text-sm text-slate-500">{item.storageLocation || "No stock location"} - {item.itemType.replaceAll("_", " ")}</p>
              </div>
              <Badge className="bg-slate-100 text-slate-700 ring-slate-200">Archived</Badge>
            </div>
            <div className="mt-3 rounded-md bg-white p-3 text-sm text-slate-600">
              This stock item is archived and hidden from normal stock workflows. It cannot be issued or loaned until restored.
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href={`/stock/${item.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                <Package size={17} />
                Open stock
              </Link>
              <Link href={`/data-quality`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <AlertTriangle size={17} />
                Review cleanup
              </Link>
            </div>
          </article>
        ))}
      </section>

      {scannerOpen ? <CameraScanner onDetected={(value) => lookup(value, { closeScanner: false })} onClose={() => setScannerOpen(false)} title="Quick inventory scan" /> : null}
    </div>
  );
}

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : "";
}

function CameraAccessNotice() {
  const showWarning = useSyncExternalStore(
    () => () => undefined,
    () => {
      const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
      return !window.isSecureContext && !isLocalhost;
    },
    () => false,
  );

  if (!showWarning) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      Camera scanning needs HTTPS on phones. If this app is opened with plain HTTP, use the photo/manual fallback or serve the app through HTTPS.
    </div>
  );
}
