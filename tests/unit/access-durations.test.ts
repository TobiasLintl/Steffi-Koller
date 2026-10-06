import { describe, expect, it } from "vitest";

import {
  addMonths,
  entitlementState,
  extendedExpiry,
  initialExpiry,
  TIER_DEFAULTS,
} from "@/server/domain/access";

const d = (iso: string) => new Date(iso);

describe("access duration (AK-05)", () => {
  it("small and medium courses end after 6 months", () => {
    const start = d("2026-01-15T10:00:00Z");
    for (const tier of ["small", "medium"] as const) {
      expect(initialExpiry(start, TIER_DEFAULTS[tier].accessMonths)).toEqual(
        d("2026-07-15T10:00:00Z"),
      );
    }
  });

  it("the large course ends after 24 months", () => {
    expect(initialExpiry(d("2026-01-15T10:00:00Z"), TIER_DEFAULTS.large.accessMonths)).toEqual(
      d("2028-01-15T10:00:00Z"),
    );
  });

  it("free products can be unlimited", () => {
    expect(initialExpiry(d("2026-01-15T10:00:00Z"), null)).toBeNull();
  });

  it("an entitlement is active until the expiry instant, then expired", () => {
    const start = d("2026-01-15T10:00:00Z");
    const ent = { status: "active" as const, startsAt: start, expiresAt: initialExpiry(start, 6) };
    expect(entitlementState(ent, d("2026-07-15T09:59:59Z"))).toBe("active");
    expect(entitlementState(ent, d("2026-07-15T10:00:00Z"))).toBe("expired");
    expect(entitlementState({ ...ent, status: "revoked" }, d("2026-02-01T00:00:00Z"))).toBe(
      "revoked",
    );
  });

  it("clamps to the end of shorter months", () => {
    expect(addMonths(d("2026-08-31T12:00:00Z"), 6)).toEqual(d("2027-02-28T12:00:00Z"));
    expect(addMonths(d("2027-08-31T12:00:00Z"), 6)).toEqual(d("2028-02-29T12:00:00Z"));
  });

  it("rejects non-positive durations", () => {
    expect(() => initialExpiry(new Date(), 0)).toThrow();
    expect(() => extendedExpiry(new Date(), new Date(), -3)).toThrow();
  });
});

describe("extension (AK-06)", () => {
  it("extends a running entitlement from its current expiry", () => {
    const now = d("2026-05-01T00:00:00Z");
    expect(extendedExpiry(d("2026-07-15T10:00:00Z"), now, 3)).toEqual(d("2026-10-15T10:00:00Z"));
    expect(extendedExpiry(d("2028-01-15T10:00:00Z"), now, 6)).toEqual(d("2028-07-15T10:00:00Z"));
  });

  it("extends an expired entitlement from now", () => {
    const now = d("2026-09-01T08:00:00Z");
    expect(extendedExpiry(d("2026-07-15T10:00:00Z"), now, 3)).toEqual(d("2026-12-01T08:00:00Z"));
  });

  it("keeps unlimited entitlements unlimited", () => {
    expect(extendedExpiry(null, new Date(), 3)).toBeNull();
  });
});
