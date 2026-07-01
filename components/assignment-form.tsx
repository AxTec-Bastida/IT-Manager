"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import type { AssignmentTarget, Device, Employee } from "@prisma/client";
import {
  ClipboardCheck,
  ClipboardList,
  PackageCheck,
  X,
  Search,
  Trash2,
  AlertTriangle,
  UserPlus,
  Mail,
  Camera
} from "lucide-react";
import { SignaturePad } from "@/components/signature-pad";
import { categoryLabels, conditionLabels } from "@/lib/constants";
import { ScanAutocomplete } from "@/components/scan-autocomplete";
import { CameraScanner } from "@/components/camera-scanner";

export type TransferConflict = {
  assetId: string;
  assetTag: string | null;
  name: string;
  assignedTo: string;
};

export function AssignmentForm({
  employees,
  assets,
  targets = [],
  defaultTechName = ""
}: {
  employees: Employee[];
  assets: Device[];
  targets?: AssignmentTarget[];
  defaultTechName?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Employee targets
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    employees.find((e) => e.id === searchParams.get("employeeId")) ?? null
  );
  const [targetMode, setTargetMode] = useState<"EMPLOYEE" | "TEAM" | "AREA" | "STATION">(
    (searchParams.get("targetType") as "EMPLOYEE" | "TEAM" | "AREA" | "STATION") || "EMPLOYEE"
  );
  const [targetPath, setTargetPath] = useState(searchParams.get("targetPath") ?? "");

  // Badge scan / lookup states
  const [badgeScanInput, setBadgeScanInput] = useState("");
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [noEmployeeFoundBadge, setNoEmployeeFoundBadge] = useState<string | null>(null);

  // New Profile nested form
  const [showCreateProfile, setShowCreateProfile] = useState<"EMPLOYEE" | "BORROWER" | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileBadgeId, setNewProfileBadgeId] = useState("");
  const [newProfileEmail, setNewProfileEmail] = useState("");
  const [newProfileDept, setNewProfileDept] = useState("");
  const [newProfileSupervisorName, setNewProfileSupervisorName] = useState("");
  const [newProfileSupervisorEmail, setNewProfileSupervisorEmail] = useState("");
  const [newProfileNotes, setNewProfileNotes] = useState("");
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Assets states
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    searchParams.get("assetId") ? [searchParams.get("assetId")!] : []
  );
  const [scannedAssetDetails, setScannedAssetDetails] = useState<Device[]>(() => {
    const defaultId = searchParams.get("assetId");
    if (defaultId) {
      const asset = assets.find((a) => a.id === defaultId);
      return asset ? [asset] : [];
    }
    return [];
  });
  const [assetScanInput, setAssetScanInput] = useState("");
  const [assetError, setAssetError] = useState<string | null>(null);

  // Already assigned / transfer warnings
  const [transferConflicts, setTransferConflicts] = useState<TransferConflict[]>([]);
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  // Form submit & SMTP status
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean } | null>(null);

  const [assigneeScannerOpen, setAssigneeScannerOpen] = useState(false);
  const [assetScannerOpen, setAssetScannerOpen] = useState(false);
  const [customEmailTo, setCustomEmailTo] = useState("");
  const [customEmailCc, setCustomEmailCc] = useState("");

  // Load SMTP config status
  useEffect(() => {
    async function fetchSmtp() {
      try {
        await fetch("/api/email/test"); // wait, check if there's a setting/config endpoint
        // Let's just fetch settings or run diagnostic
        const configRes = await fetch("/api/settings");
        if (configRes.ok) {
          const data = await configRes.json();
          // Settings might show SMTP host
          setSmtpStatus({ configured: !!data.settings?.smtpHost });
        }
      } catch {
        setSmtpStatus({ configured: false });
      }
    }
    fetchSmtp();
  }, []);

  function clearNewProfileFields() {
    setNewProfileName("");
    setNewProfileBadgeId("");
    setNewProfileEmail("");
    setNewProfileDept("");
    setNewProfileSupervisorName("");
    setNewProfileSupervisorEmail("");
    setNewProfileNotes("");
  }

  function addDevice(device: Device) {
    if (selectedAssetIds.includes(device.id)) return;
    setSelectedAssetIds((cur) => [...cur, device.id]);
    setScannedAssetDetails((cur) => {
      if (cur.some((d) => d.id === device.id)) return cur;
      return [...cur, device];
    });
    // Reset transfer conflicts because selection changed
    setTransferConflicts([]);
    setConfirmTransfer(false);
  }

  function removeDevice(id: string) {
    setSelectedAssetIds((cur) => cur.filter((assetId) => assetId !== id));
    setScannedAssetDetails((cur) => cur.filter((d) => d.id !== id));
    setTransferConflicts([]);
    setConfirmTransfer(false);
  }

  async function handleBadgeLookup(value: string) {
    const q = value.trim();
    if (!q) return;
    setEmployeeError(null);
    setNoEmployeeFoundBadge(null);

    // Local check first
    const local = employees.find(
      (e) =>
        e.badgeId?.toLowerCase() === q.toLowerCase() ||
        e.employeeId?.toLowerCase() === q.toLowerCase()
    );
    if (local) {
      setSelectedEmployee(local);
      setBadgeScanInput("");
      return;
    }

    try {
      const res = await fetch("/api/scan-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: q }),
      });
      if (!res.ok) {
        setEmployeeError("Failed to lookup badge.");
        return;
      }
      const data = await res.json();
      if (data.employees && data.employees.length > 0) {
        setSelectedEmployee(data.employees[0]);
        setBadgeScanInput("");
      } else if (data.temporaryBorrowers && data.temporaryBorrowers.length > 0) {
        const borrower = data.temporaryBorrowers[0];
        setEmployeeError(
          `⚠️ Found Temporary Borrower: "${borrower.name}". Assignments are for long-term responsibility and require an Employee profile. Please convert this borrower to an Employee profile or use Quick Asset Loan.`
        );
      } else {
        setNoEmployeeFoundBadge(q);
      }
    } catch {
      setEmployeeError("Error connecting to server.");
    }
  }

  async function handleAssetScanLookup(value: string) {
    const q = value.trim();
    if (!q) return;
    setAssetError(null);

    const local = assets.find(
      (a) =>
        a.assetTag?.toLowerCase() === q.toLowerCase() ||
        a.serialNumber?.toLowerCase() === q.toLowerCase()
    );
    if (local) {
      addDevice(local);
      setAssetScanInput("");
      return;
    }

    try {
      const res = await fetch("/api/scan-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: q }),
      });
      if (!res.ok) {
        setAssetError("Failed to lookup asset.");
        return;
      }
      const data = await res.json();
      if (data.devices && data.devices.length > 0) {
        addDevice(data.devices[0]);
        setAssetScanInput("");
      } else {
        setAssetError(`Asset "${q}" not found in inventory.`);
      }
    } catch {
      setAssetError("Error connecting to server.");
    }
  }

  async function handleCreateProfile(type: "EMPLOYEE" | "BORROWER") {
    if (!newProfileName.trim()) {
      setEmployeeError("Name is required.");
      return;
    }
    setCreatingProfile(true);
    setEmployeeError(null);

    try {
      if (type === "EMPLOYEE") {
        const res = await fetch("/api/employees", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fullName: newProfileName,
            badgeId: newProfileBadgeId || undefined,
            email: newProfileEmail || undefined,
            department: newProfileDept || undefined,
            supervisorName: newProfileSupervisorName || undefined,
            supervisorEmail: newProfileSupervisorEmail || undefined,
            notes: newProfileNotes || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setEmployeeError(data.error || "Failed to create employee profile.");
        } else {
          setSelectedEmployee(data.employee);
          setShowCreateProfile(null);
          setNoEmployeeFoundBadge(null);
          clearNewProfileFields();
        }
      } else {
        const res = await fetch("/api/temporary-borrowers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: newProfileName,
            badgeId: newProfileBadgeId || undefined,
            email: newProfileEmail || undefined,
            department: newProfileDept || undefined,
            supervisorName: newProfileSupervisorName || undefined,
            notes: newProfileNotes || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setEmployeeError(data.error || "Failed to create temporary borrower.");
        } else {
          setEmployeeError(
            `Temporary Borrower "${data.borrower.name}" created! Note: Assignments require an Employee profile. Please convert them to an Employee profile or use Quick Asset Loan.`
          );
          setShowCreateProfile(null);
          setNoEmployeeFoundBadge(null);
          clearNewProfileFields();
        }
      }
    } catch {
      setEmployeeError("Error connecting to server.");
    } finally {
      setCreatingProfile(false);
    }
  }

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    const payload = {
      ...Object.fromEntries(formData.entries()),
      termsAccepted: formData.get("termsAccepted") === "on",
      assetIds: selectedAssetIds,
      confirmTransfer,
    };
    try {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      setSaving(false);
      if (!response.ok) {
        if (data.error === "already_assigned") {
          setTransferConflicts(data.conflicts || []);
          setError("One or more assets are already assigned. Please confirm transfer of these assets to continue.");
        } else {
          setError(data.error || "Unable to create assignment.");
        }
        return;
      }

      // Check if SMTP email was skipped
      if (data.emailResult?.skipped) {
        router.push(`/assignments/${data.assignment.id}?emailWarning=skipped`);
      } else {
        router.push(`/assignments/${data.assignment.id}`);
      }
      router.refresh();
    } catch {
      setSaving(false);
      setError("Network error. Unable to save assignment.");
    }
  }

  return (
    <form action={onSubmit} className="space-y-6 max-w-xl mx-auto px-4 sm:px-0">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="shrink-0 text-rose-600" size={18} />
          <div>
            <p className="font-semibold">Submit Error</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 text-sm text-sky-950 shadow-sm">
        <p className="font-semibold text-base text-sky-950 flex items-center gap-2">
          <ClipboardCheck size={18} className="text-sky-700" />
          Long-term Responsibility Assignment
        </p>
        <p className="mt-1.5 text-sky-800 leading-relaxed">
          Assignments are for permanent/long-term equipment responsibility.
          For short-term checkout, use <strong>Quick Asset Loan</strong>. For peripherals/cables, use <strong>Issue / Loan Item</strong>.
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <Link
            href="/loans/quick-checkout"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-sky-300 bg-white px-3 font-semibold text-sky-900 hover:bg-sky-100 transition-colors"
          >
            <ClipboardList size={16} />
            Quick Asset Loan
          </Link>
          <Link
            href="/stock/issue"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-sky-300 bg-white px-3 font-semibold text-sky-900 hover:bg-sky-100 transition-colors"
          >
            <PackageCheck size={16} />
            Issue / Loan Item
          </Link>
        </div>
      </section>

      {/* 1. RESPONSIBILITY TARGET */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-base text-slate-950">1. Who receives the equipment?</h2>
          <p className="text-xs text-slate-500 mt-0.5">Select a person, department, or station.</p>
        </div>

        <input type="hidden" name="targetType" value={targetMode} />

        <div className="grid grid-cols-3 gap-2">
          {[
            ["EMPLOYEE", "Person"],
            ["TEAM", "Team"],
            ["AREA", "Area / Station"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTargetMode(value as typeof targetMode);
                setEmployeeError(null);
                setNoEmployeeFoundBadge(null);
                setShowCreateProfile(null);
              }}
              className={`min-h-11 rounded-lg border px-2 text-xs sm:text-sm font-semibold transition-colors ${
                targetMode === value
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {targetMode === "EMPLOYEE" ? (
          <div className="space-y-3">
            {/* Badge lookup */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Scan or type Badge ID / Name..."
                  value={badgeScanInput}
                  onChange={(e) => setBadgeScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBadgeLookup(badgeScanInput);
                    }
                  }}
                  className="w-full min-h-11 rounded-lg border border-slate-300 pl-9 pr-10 text-sm focus:border-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setAssigneeScannerOpen(true)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  title="Scan assignee badge"
                >
                  <Camera size={14} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleBadgeLookup(badgeScanInput)}
                className="px-4 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg text-sm font-medium transition-colors"
              >
                Lookup
              </button>
            </div>

            {/* Auto-complete name lookup */}
            <div className="text-center text-xs text-slate-400 font-medium">— OR —</div>
            <ScanAutocomplete
              show={["employees"]}
              placeholder="Search employee by name..."
              inputClassName="min-h-11 py-2"
              onSelect={(s) => {
                if (s.kind === "employee") {
                  const emp = employees.find((e) => e.id === s.id) ?? null;
                  setSelectedEmployee(emp);
                  setEmployeeError(null);
                  setNoEmployeeFoundBadge(null);
                  setShowCreateProfile(null);
                }
              }}
            />

            {employeeError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="shrink-0 text-amber-700 mt-0.5" size={14} />
                <span>{employeeError}</span>
              </div>
            )}

            {noEmployeeFoundBadge && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <p className="text-xs text-slate-600">
                  No employee found for badge: <strong>{noEmployeeFoundBadge}</strong>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateProfile("EMPLOYEE");
                      setNewProfileBadgeId(noEmployeeFoundBadge);
                    }}
                    className="flex-1 min-h-10 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <UserPlus size={14} />
                    Create Employee
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateProfile("BORROWER");
                      setNewProfileBadgeId(noEmployeeFoundBadge);
                    }}
                    className="flex-1 min-h-10 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <UserPlus size={14} />
                    Create Borrower
                  </button>
                </div>
              </div>
            )}

            {/* Create profile subform */}
            {showCreateProfile && (
              <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Create {showCreateProfile === "EMPLOYEE" ? "Employee Profile" : "Temporary Borrower"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateProfile(null)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Full Name *
                    <input
                      type="text"
                      className="mt-1 w-full min-h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Badge ID
                    <input
                      type="text"
                      className="mt-1 w-full min-h-10 border border-slate-300 bg-slate-100 rounded-lg px-3 text-sm focus:outline-none"
                      value={newProfileBadgeId}
                      onChange={(e) => setNewProfileBadgeId(e.target.value)}
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Email (Optional)
                    <input
                      type="email"
                      className="mt-1 w-full min-h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none"
                      value={newProfileEmail}
                      onChange={(e) => setNewProfileEmail(e.target.value)}
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Department / Area (Optional)
                    <input
                      type="text"
                      className="mt-1 w-full min-h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none"
                      value={newProfileDept}
                      onChange={(e) => setNewProfileDept(e.target.value)}
                    />
                  </label>

                  {showCreateProfile === "EMPLOYEE" && (
                    <>
                      <label className="block text-xs font-semibold text-slate-700">
                        Supervisor Name (Optional)
                        <input
                          type="text"
                          className="mt-1 w-full min-h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none"
                          value={newProfileSupervisorName}
                          onChange={(e) => setNewProfileSupervisorName(e.target.value)}
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Supervisor Email (Optional)
                        <input
                          type="email"
                          className="mt-1 w-full min-h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none"
                          value={newProfileSupervisorEmail}
                          onChange={(e) => setNewProfileSupervisorEmail(e.target.value)}
                        />
                      </label>
                    </>
                  )}

                  <label className="block text-xs font-semibold text-slate-700">
                    Notes
                    <textarea
                      className="mt-1 w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none"
                      rows={2}
                      value={newProfileNotes}
                      onChange={(e) => setNewProfileNotes(e.target.value)}
                    />
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleCreateProfile(showCreateProfile)}
                    disabled={creatingProfile}
                    className="flex-1 min-h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    {creatingProfile ? "Creating..." : "Confirm & Save Profile"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateProfile(null);
                      clearNewProfileFields();
                    }}
                    className="px-4 min-h-11 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Selected Employee card */}
            {selectedEmployee && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{selectedEmployee.fullName}</p>
                  <div className="text-xs text-slate-600 mt-0.5 space-y-0.5">
                    <p>Badge ID: {selectedEmployee.badgeId || "-"}</p>
                    <p>Email: {selectedEmployee.email || "-"}</p>
                    <p>Supervisor: {selectedEmployee.supervisorName || "-"}</p>
                    <p>Department: {selectedEmployee.department || "-"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmployee(null)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                >
                  <X size={16} />
                </button>
                <input type="hidden" name="employeeId" value={selectedEmployee.id} />
              </div>
            )}
            {!selectedEmployee && <input type="hidden" name="employeeId" value="" />}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Responsibility path
              <input
                name="targetPath"
                value={targetPath}
                onChange={(event) => setTargetPath(event.target.value)}
                placeholder="Ops > Fabletics > Pack"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:outline-none"
              />
            </label>
            <input type="hidden" name="targetName" value={targetPath.split(">").pop()?.trim() || targetPath} />
            <div className="flex flex-wrap gap-1.5">
              {[
                ...new Set([
                  "Operations",
                  "Ops > Fabletics > Pack",
                  "Returns",
                  "Shipping",
                  "IT",
                  "Packing Station 4",
                  ...targets.slice(0, 8).map((target) => target.path),
                ]),
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setTargetPath(chip)}
                  className="rounded-full bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 2. WHAT ASSETS ARE ASSIGNED? */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-base text-slate-950">2. What assets are assigned?</h2>
          <p className="text-xs text-slate-500 mt-0.5">Scan asset tag or serial. You can also search manually.</p>
        </div>

        {/* Scan Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Scan Asset Tag or Serial..."
              value={assetScanInput}
              onChange={(e) => setAssetScanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAssetScanLookup(assetScanInput);
                }
              }}
              className="w-full min-h-11 rounded-lg border border-slate-300 pl-9 pr-10 text-sm focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setAssetScannerOpen(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              title="Scan asset badge"
            >
              <Camera size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleAssetScanLookup(assetScanInput)}
            className="px-4 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg text-sm font-medium transition-colors"
          >
            Add
          </button>
        </div>

        {/* Manual search fallback */}
        <div className="text-center text-xs text-slate-400 font-medium">— OR —</div>
        <ScanAutocomplete
          show={["devices"]}
          placeholder="Search devices manually..."
          inputClassName="min-h-11 py-2"
          onSelect={(s) => {
            if (s.kind === "device") {
              const dev = assets.find((a) => a.id === s.id);
              if (dev) {
                addDevice(dev);
                setAssetError(null);
              }
            }
          }}
        />

        {assetError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="shrink-0 text-rose-700 mt-0.5" size={14} />
            <span>{assetError}</span>
          </div>
        )}

        {/* Selected asset cards */}
        <div className="space-y-2.5">
          {scannedAssetDetails.length > 0 ? (
            scannedAssetDetails.map((asset) => {
              const isLaptop = asset.category === "LAPTOP";
              const isConflicted = transferConflicts.some((c) => c.assetId === asset.id);

              return (
                <div
                  key={asset.id}
                  className={`rounded-xl border p-3.5 shadow-sm space-y-3 transition-colors ${
                    isConflicted ? "border-rose-300 bg-rose-50/30" : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{asset.name}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Tag: {asset.assetTag || "-"} / SN: {asset.serialNumber || "-"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {categoryLabels[asset.category]} / {conditionLabels[asset.condition]}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDevice(asset.id)}
                      className="text-slate-400 hover:text-rose-600 rounded-full p-1.5 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Charger Included checkbox for laptops */}
                  {isLaptop && (
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 select-none">
                      <input
                        type="checkbox"
                        name={`chargerIncluded_${asset.id}`}
                        defaultChecked={true}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      Laptop Charger Included
                    </label>
                  )}

                  {/* Conflict alert & transfer confirmation */}
                  {isConflicted && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-2">
                      <p className="text-xs text-rose-950 font-medium">
                        ⚠️ Already Assigned: Held by{" "}
                        <strong>
                          {transferConflicts.find((c) => c.assetId === asset.id)?.assignedTo || "Someone"}
                        </strong>
                      </p>
                      <label className="flex items-start gap-2 text-xs font-bold text-rose-900 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmTransfer}
                          onChange={(e) => setConfirmTransfer(e.target.checked)}
                          className="mt-0.5 rounded border-rose-300 text-rose-900 focus:ring-rose-900"
                        />
                        Confirm Transfer of Asset
                      </label>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-sm text-slate-500">
              No assets selected. Scan or lookup above.
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 font-semibold">{selectedAssetIds.length} assets selected</p>
      </section>

      {/* 3. TERMS AND SIGNATURE */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-base text-slate-950">3. Terms and signature</h2>
          <p className="text-xs text-slate-500 mt-0.5">Please sign and fill tech name below.</p>
        </div>

        <label className="block text-sm font-semibold text-slate-700">
          Assigned by
          <input
            name="assignedBy"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:outline-none"
            placeholder="IT technician name"
            defaultValue={defaultTechName}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Terms
          <textarea
            name="termsText"
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
            defaultValue="I acknowledge receipt of this equipment and accept responsibility for returning it in good condition when requested."
          />
        </label>

        <label className="flex items-start gap-2.5 text-xs text-slate-700 select-none cursor-pointer">
          <input name="termsAccepted" type="checkbox" className="mt-0.5 size-4 rounded text-slate-900 focus:ring-slate-900" required />
          Responsible person or area accepted the responsibility terms.
        </label>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">Assignee Signature</p>
          <SignaturePad />
        </div>

        <label className="block text-sm font-semibold text-slate-700">
          Notes
          <textarea
            name="notes"
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />
        </label>

        {/* Email settings and preview */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-3">
          <p className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
            <Mail size={16} className="text-slate-500" />
            Email Confirmation Settings
          </p>
          {smtpStatus?.configured === false && (
            <p className="text-amber-800 font-medium">
              ⚠️ Note: SMTP is not configured. Email confirmation will be logged but not sent.
            </p>
          )}
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700">Send confirmation to</span>
              <input
                type="email"
                name="emailTo"
                placeholder={selectedEmployee?.email || "No assignee email on file"}
                value={customEmailTo}
                onChange={(e) => setCustomEmailTo(e.target.value)}
                className="w-full min-h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-950 focus:outline-none"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700">Additional CC list (comma-separated)</span>
              <input
                type="text"
                name="emailCc"
                placeholder="e.g. hr@g-global.com, ops@g-global.com"
                value={customEmailCc}
                onChange={(e) => setCustomEmailCc(e.target.value)}
                className="w-full min-h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-950 focus:outline-none"
              />
            </label>
            <div className="rounded-md border border-slate-200 bg-white p-2.5 space-y-1 text-[11px] text-slate-500">
              <p className="font-semibold text-slate-700 uppercase tracking-wider text-[9px]">Notification routing chain:</p>
              <p>• <strong>To:</strong> {customEmailTo || selectedEmployee?.email || "(no recipient address)"}</p>
              <p>• <strong>CC:</strong> {[
                selectedEmployee?.supervisorEmail,
                "it.techstyle@g-global.com",
                customEmailCc,
              ].filter((e): e is string => Boolean(e && e.trim())).map(e => e.trim()).join(", ") || "(no CC addresses)"}</p>
            </div>
          </div>
        </div>
      </section>

      <button
        className={`sticky bottom-6 w-full min-h-14 rounded-lg bg-slate-950 px-4 text-base font-semibold text-white shadow-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 z-10 disabled:opacity-60`}
        disabled={saving}
      >
        <ClipboardCheck size={18} />
        {saving
          ? "Creating assignment..."
          : confirmTransfer
          ? "Confirm Transfer & Submit"
          : "Submit assignment"}
      </button>
      {assigneeScannerOpen ? (
        <CameraScanner
          title="Scan assignee badge"
          onDetected={(value) => {
            setBadgeScanInput(value);
            handleBadgeLookup(value);
            setAssigneeScannerOpen(false);
          }}
          onClose={() => setAssigneeScannerOpen(false)}
        />
      ) : null}

      {assetScannerOpen ? (
        <CameraScanner
          title="Scan asset barcode"
          onDetected={(value) => {
            setAssetScanInput(value);
            handleAssetScanLookup(value);
            setAssetScannerOpen(false);
          }}
          onClose={() => setAssetScannerOpen(false)}
        />
      ) : null}
    </form>
  );
}
