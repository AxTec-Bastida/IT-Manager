"use client";

import { useState, ComponentType } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, HelpCircle, History, RefreshCw, Zap } from "lucide-react";

type MaintenanceRecord = {
  id: string;
  maintenanceType: string;
  result: string;
  performedAt: Date;
  performedBy: string | null;
  notes: string | null;
};

type Props = {
  deviceId: string;
  currentStatus: string | null;
  currentNotes: string | null;
  maintenanceHistory: MaintenanceRecord[];
  canWrite: boolean;
};

export function ChargerStatusPanel({ deviceId, currentStatus = "HEALTHY", currentNotes, maintenanceHistory, canWrite }: Props) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [notesInput, setNotesInput] = useState("");
  const [showReplaceForm, setShowReplaceForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = currentStatus || "HEALTHY";

  async function updateStatus(newStatus: string, notes: string) {
    setUpdating(true);
    setError(null);
    try {
      const response = await fetch(`/api/devices/${deviceId}/charger`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update charger status.");
      }
      setNotesInput("");
      setShowReplaceForm(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdating(false);
    }
  }

  const replacements = maintenanceHistory.filter(
    (record) => record.maintenanceType === "POWER_SUPPLY_REPLACEMENT"
  );

  const statusConfigs: Record<string, { label: string; tone: string; icon: ComponentType<{ className?: string; size?: number }>; desc: string }> = {
    HEALTHY: {
      label: "Healthy / OK",
      tone: "bg-emerald-50 text-emerald-800 border-emerald-200 ring-emerald-100",
      icon: CheckCircle2,
      desc: "Charger is present and fully functional.",
    },
    DAMAGED: {
      label: "Damaged",
      tone: "bg-rose-50 text-rose-800 border-rose-200 ring-rose-100",
      icon: AlertTriangle,
      desc: "Charger is physically damaged or malfunctioning.",
    },
    MISSING: {
      label: "Missing",
      tone: "bg-amber-50 text-amber-800 border-amber-200 ring-amber-100",
      icon: HelpCircle,
      desc: "Charger has been reported missing or lost.",
    },
    REPLACED: {
      label: "Replaced",
      tone: "bg-indigo-50 text-indigo-800 border-indigo-200 ring-indigo-100",
      icon: RefreshCw,
      desc: "Charger has been replaced with a new one.",
    },
  };

  const config = statusConfigs[status] || statusConfigs.HEALTHY;
  const StatusIcon = config.icon;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="text-amber-500" size={20} />
          <h2 className="font-semibold text-slate-950">Charger Tracking</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ${config.tone}`}>
            <StatusIcon size={12} />
            {config.label}
          </span>
        </div>
      </div>

      <p className="mt-2 text-sm text-slate-600">{config.desc}</p>
      
      {currentNotes ? (
        <div className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-700">
          <span className="font-semibold">Current charger details:</span> {currentNotes}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-md bg-rose-50 p-2.5 text-xs font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      {canWrite ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {!showReplaceForm ? (
            <div className="flex flex-wrap gap-2">
              {status !== "HEALTHY" && (
                <button
                  disabled={updating}
                  onClick={() => updateStatus("HEALTHY", "Charger verified OK.")}
                  className="inline-flex min-h-10 items-center justify-center cursor-pointer rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Mark Healthy / OK
                </button>
              )}
              {status !== "DAMAGED" && (
                <button
                  disabled={updating}
                  onClick={() => updateStatus("DAMAGED", "Charger reported damaged.")}
                  className="inline-flex min-h-10 items-center justify-center cursor-pointer rounded-md border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  Report Damaged
                </button>
              )}
              {status !== "MISSING" && (
                <button
                  disabled={updating}
                  onClick={() => updateStatus("MISSING", "Charger reported missing.")}
                  className="inline-flex min-h-10 items-center justify-center cursor-pointer rounded-md border border-amber-200 bg-white px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                >
                  Report Missing
                </button>
              )}
              {status !== "REPLACED" && (
                <button
                  disabled={updating}
                  onClick={() => setShowReplaceForm(true)}
                  className="inline-flex min-h-10 items-center justify-center cursor-pointer rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  Replace Charger
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Replacement Notes (optional details/serial/vendor)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Zebra 60W USB-C, Ticket #12345"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  disabled={updating}
                  onClick={() => updateStatus("REPLACED", notesInput)}
                  className="inline-flex min-h-9 items-center justify-center cursor-pointer rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {updating ? "Processing..." : "Confirm Replacement"}
                </button>
                <button
                  disabled={updating}
                  onClick={() => {
                    setShowReplaceForm(false);
                    setNotesInput("");
                  }}
                  className="inline-flex min-h-9 items-center justify-center cursor-pointer rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {replacements.length > 0 ? (
        <details className="mt-4 border-t border-slate-100 pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-800 hover:text-slate-950 focus:outline-none">
            <span className="flex items-center gap-1.5">
              <History size={13} />
              Charger replacement history ({replacements.length})
            </span>
            <span className="text-[10px] text-slate-500 uppercase">View</span>
          </summary>
          <div className="mt-2 max-h-36 overflow-y-auto space-y-2 pr-1">
            {replacements.map((record) => (
              <div key={record.id} className="rounded border border-slate-100 bg-slate-50 p-2 text-xs">
                <div className="flex justify-between font-semibold text-slate-950">
                  <span>Replaced by {record.performedBy || "System"}</span>
                  <span className="text-slate-500">{new Date(record.performedAt).toLocaleDateString()}</span>
                </div>
                {record.notes ? <p className="mt-1 text-slate-700">{record.notes}</p> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
