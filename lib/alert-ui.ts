import type { AlertSource, AlertStatus, AlertType } from "@prisma/client";
import { AlertSource as AlertSourceEnum } from "@prisma/client";
import { alertSourceLabels, alertStatusLabels, alertTypeLabels } from "@/lib/constants";

export function alertSourceLabel(source: AlertSource | string) {
  if (source === "UNIFI") return "Legacy AP Sync (Disabled)";
  return alertSourceLabels[source as AlertSource] ?? String(source).replaceAll("_", " ");
}

export function visibleAlertSourceOptions(selectedSource = "") {
  return Object.values(AlertSourceEnum).filter((value) => value !== "UNIFI" || selectedSource === "UNIFI");
}

export function buildActiveAlertFilters(input: { status?: string | null; severity?: string | null; source?: string | null; type?: string | null; assetId?: string | null }) {
  return [
    input.status ? alertStatusLabels[input.status as AlertStatus] : null,
    input.severity ? `Severity: ${input.severity}` : null,
    input.source ? alertSourceLabel(input.source) : null,
    input.type ? alertTypeLabels[input.type as AlertType] : null,
    input.assetId ? "Asset selected" : null,
  ].filter((value): value is string => Boolean(value));
}

export function alertFilterHref(next: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/alerts?${query}` : "/alerts";
}

export function formatAlertTextForUi(value: string) {
  return value
    .replace(/switch\/UniFi client data/gi, "switch/network client data")
    .replace(/UniFi client data/gi, "network client data")
    .replace(/UniFi/gi, "legacy AP sync");
}
