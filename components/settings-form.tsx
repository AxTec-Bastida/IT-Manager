"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AppSettings } from "@prisma/client";
import { Save } from "lucide-react";
import { categoryLabels, categoryOptions } from "@/lib/constants";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";
  const checkboxClass = "flex min-h-12 items-center gap-2 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const payload = {
      ...Object.fromEntries(formData.entries()),
      autoSaveScanResults: formData.get("autoSaveScanResults") === "on",
      enablePrinterMaintenanceAlerts: formData.get("enablePrinterMaintenanceAlerts") === "on",
      enableLowStockAlerts: formData.get("enableLowStockAlerts") === "on",
      enableConflictAlerts: formData.get("enableConflictAlerts") === "on",
      enableWarrantyAlerts: formData.get("enableWarrantyAlerts") === "on",
      enableMovementAlerts: formData.get("enableMovementAlerts") === "on",
      autoResolveMovementAlerts: formData.get("autoResolveMovementAlerts") === "on",
      enableMissingAssetSeenOnlineAlerts: formData.get("enableMissingAssetSeenOnlineAlerts") === "on",
      alertDuplicateSuppressionEnabled: formData.get("alertDuplicateSuppressionEnabled") === "on",
    };
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    setMessage(response.ok ? "Settings saved." : "Unable to save settings.");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-5">
      {message ? <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Site defaults</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Company/site name
            <input className={inputClass} name="siteName" defaultValue={settings.siteName} />
          </label>
          <label className={labelClass}>
            Default VLAN
            <input className={inputClass} name="defaultVlan" type="number" min="1" max="4094" defaultValue={settings.defaultVlan} />
          </label>
          <label className={labelClass}>
            Default category
            <select className={inputClass} name="defaultCategory" defaultValue={settings.defaultCategory}>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Default currency
            <input className={inputClass} name="defaultCurrency" defaultValue={settings.defaultCurrency} />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Scanner</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Max scan size
            <input className={inputClass} name="maxScanSize" type="number" min="1" max="512" defaultValue={settings.maxScanSize} />
          </label>
          <label className={labelClass}>
            Ping timeout ms
            <input className={inputClass} name="pingTimeoutMs" type="number" min="100" max="5000" defaultValue={settings.pingTimeoutMs} />
          </label>
          <label className={checkboxClass}>
            <input className="size-4 rounded border-slate-300" name="autoSaveScanResults" type="checkbox" defaultChecked={settings.autoSaveScanResults} />
            Auto-save scan results
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Stock / maintenance</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Default low stock threshold
            <input className={inputClass} name="defaultLowStockThreshold" type="number" min="0" defaultValue={settings.defaultLowStockThreshold} />
          </label>
          <label className={labelClass}>
            Thermal printer cleaning interval days
            <input className={inputClass} name="defaultThermalCleaningIntervalDays" type="number" min="1" defaultValue={settings.defaultThermalCleaningIntervalDays} />
          </label>
          <label className={labelClass}>
            MFP low toner/ink threshold %
            <input className={inputClass} name="defaultMfpLowSupplyThreshold" type="number" min="0" max="100" defaultValue={settings.defaultMfpLowSupplyThreshold} />
          </label>
          <label className={checkboxClass}>
            <input className="size-4 rounded border-slate-300" name="enablePrinterMaintenanceAlerts" type="checkbox" defaultChecked={settings.enablePrinterMaintenanceAlerts} />
            Enable printer maintenance alerts
          </label>
          <label className={checkboxClass}>
            <input className="size-4 rounded border-slate-300" name="enableLowStockAlerts" type="checkbox" defaultChecked={settings.enableLowStockAlerts} />
            Enable low stock alerts
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Alerts</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={checkboxClass}>
            <input className="size-4 rounded border-slate-300" name="enableConflictAlerts" type="checkbox" defaultChecked={settings.enableConflictAlerts} />
            Enable conflict alerts
          </label>
          <label className={checkboxClass}>
            <input className="size-4 rounded border-slate-300" name="enableWarrantyAlerts" type="checkbox" defaultChecked={settings.enableWarrantyAlerts} />
            Enable warranty alerts
          </label>
          <label className={labelClass}>
            Warranty alert threshold days
            <input className={inputClass} name="warrantyAlertThresholdDays" type="number" min="1" max="3650" defaultValue={settings.warrantyAlertThresholdDays} />
          </label>
          <label className={checkboxClass}>
            <input className="size-4 rounded border-slate-300" name="enableMissingAssetSeenOnlineAlerts" type="checkbox" defaultChecked={settings.enableMissingAssetSeenOnlineAlerts} />
            Legacy missing-asset online alerts (disabled unless legacy AP sync is explicitly enabled)
          </label>
          <label className={checkboxClass}>
            <input className="size-4 rounded border-slate-300" name="alertDuplicateSuppressionEnabled" type="checkbox" defaultChecked={settings.alertDuplicateSuppressionEnabled} />
            Suppress duplicate open alerts
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Map / zones</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={checkboxClass}>
            <input className="size-4 rounded border-slate-300" name="enableMovementAlerts" type="checkbox" defaultChecked={settings.enableMovementAlerts} />
            Legacy AP-based movement alerts (disabled unless legacy AP sync is explicitly enabled)
          </label>
          <label className={labelClass}>
            Default allowed zone distance
            <input className={inputClass} name="defaultAllowedZoneDistance" type="number" min="0" max="10" defaultValue={settings.defaultAllowedZoneDistance} />
          </label>
          <label className={checkboxClass}>
            <input className="size-4 rounded border-slate-300" name="autoResolveMovementAlerts" type="checkbox" defaultChecked={settings.autoResolveMovementAlerts} />
            Auto-resolve legacy movement alerts when returned
          </label>
        </div>
      </fieldset>

      <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:min-h-12 sm:w-auto sm:text-sm" disabled={saving}>
        <Save size={16} />
        {saving ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
