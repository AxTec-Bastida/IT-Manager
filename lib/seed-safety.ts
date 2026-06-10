export const destructiveSeedWarning =
  "Seed is destructive and will erase real inventory data. Set ALLOW_DESTRUCTIVE_SEED=true only for a dev reset after taking a backup.";

type SeedEnv = Record<string, string | undefined>;

export function destructiveSeedAllowed(env: SeedEnv = process.env) {
  return env.ALLOW_DESTRUCTIVE_SEED === "true";
}

export function assertDestructiveSeedAllowed(env: SeedEnv = process.env) {
  if (!destructiveSeedAllowed(env)) {
    throw new Error(destructiveSeedWarning);
  }
}
