export const legacyUnifiDisabledMessage =
  "Legacy UniFi/AP sync is disabled. Company rules do not allow UniFi API use for this app; use manual location, inventory location, IPAM, alerts, jobs, data quality, and photo compliance instead.";

type LegacyUnifiEnv = Record<string, string | undefined>;

export function isLegacyUnifiSyncEnabled(env: LegacyUnifiEnv = process.env) {
  return env.LEGACY_UNIFI_SYNC_ENABLED === "true";
}
