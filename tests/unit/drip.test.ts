import { describe, expect, it } from "vitest";

import { lessonAccess, moduleUnlocksAt } from "@/server/domain/access";

const d = (iso: string) => new Date(iso);
const ent = {
  status: "active" as const,
  startsAt: d("2026-01-01T00:00:00Z"),
  expiresAt: d("2028-01-01T00:00:00Z"),
};

describe("drip release", () => {
  it("unlocks modules relative to entitlement start", () => {
    expect(moduleUnlocksAt(ent, { unlockAfterDays: 0 })).toEqual(d("2026-01-01T00:00:00Z"));
    expect(moduleUnlocksAt(ent, { unlockAfterDays: 30 })).toEqual(d("2026-01-31T00:00:00Z"));
  });

  it("allows unlocked modules and blocks future ones with their unlock date", () => {
    const now = d("2026-01-20T00:00:00Z");
    expect(lessonAccess(ent, { unlockAfterDays: 14 }, now)).toEqual({ allowed: true });
    expect(lessonAccess(ent, { unlockAfterDays: 30 }, now)).toEqual({
      allowed: false,
      reason: "locked",
      unlocksAt: d("2026-01-31T00:00:00Z"),
    });
  });

  it("D-03: an extension does not change drip dates", () => {
    const extended = { ...ent, expiresAt: d("2028-07-01T00:00:00Z") };
    expect(moduleUnlocksAt(extended, { unlockAfterDays: 300 })).toEqual(
      moduleUnlocksAt(ent, { unlockAfterDays: 300 }),
    );
  });
});

describe("lesson access (AK-07)", () => {
  const now = d("2026-03-01T00:00:00Z");

  it("denies access without entitlement", () => {
    expect(lessonAccess(null, { unlockAfterDays: 0 }, now)).toEqual({
      allowed: false,
      reason: "no_entitlement",
    });
  });

  it("denies access when expired or revoked", () => {
    expect(
      lessonAccess({ ...ent, expiresAt: d("2026-02-01T00:00:00Z") }, { unlockAfterDays: 0 }, now),
    ).toMatchObject({
      allowed: false,
      reason: "expired",
    });
    expect(lessonAccess({ ...ent, status: "revoked" }, { unlockAfterDays: 0 }, now)).toMatchObject({
      allowed: false,
      reason: "revoked",
    });
  });
});
