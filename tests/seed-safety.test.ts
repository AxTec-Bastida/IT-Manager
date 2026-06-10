import { describe, expect, it } from "vitest";
import { assertDestructiveSeedAllowed, destructiveSeedAllowed, destructiveSeedWarning } from "@/lib/seed-safety";

describe("destructive seed safety", () => {
  it("blocks destructive seed unless explicitly enabled", () => {
    expect(destructiveSeedAllowed({ ALLOW_DESTRUCTIVE_SEED: undefined })).toBe(false);
    expect(() => assertDestructiveSeedAllowed({ ALLOW_DESTRUCTIVE_SEED: undefined })).toThrow(destructiveSeedWarning);
  });

  it("allows destructive seed only with the exact opt-in value", () => {
    expect(destructiveSeedAllowed({ ALLOW_DESTRUCTIVE_SEED: "true" })).toBe(true);
    expect(destructiveSeedAllowed({ ALLOW_DESTRUCTIVE_SEED: "TRUE" })).toBe(false);
    expect(() => assertDestructiveSeedAllowed({ ALLOW_DESTRUCTIVE_SEED: "true" })).not.toThrow();
  });
});
