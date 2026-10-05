import { describe, expect, it } from "vitest";

import { canReceiveNewsletter, hashToken, newToken } from "@/server/domain/newsletter/rules";
import {
  dueExpiryReminder,
  dueModuleUnlocks,
  expiryDedupeKey,
} from "@/server/domain/notifications/schedule";

const d = (iso: string) => new Date(iso);

describe("newsletter double opt-in (AK-10)", () => {
  it("only confirmed subscriptions may receive newsletters", () => {
    expect(canReceiveNewsletter({ status: "pending", confirmedAt: null })).toBe(false);
    expect(
      canReceiveNewsletter({ status: "unsubscribed", confirmedAt: d("2026-01-01T00:00:00Z") }),
    ).toBe(false);
    expect(canReceiveNewsletter({ status: "confirmed", confirmedAt: null })).toBe(false);
    expect(
      canReceiveNewsletter({ status: "confirmed", confirmedAt: d("2026-01-01T00:00:00Z") }),
    ).toBe(true);
  });

  it("stores only token hashes", () => {
    const { token, hash } = newToken();
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });
});

describe("scheduled notifications", () => {
  const ent = {
    status: "active" as const,
    startsAt: d("2026-01-01T06:00:00Z"),
    expiresAt: d("2028-01-01T06:00:00Z"),
  };
  const modules = [
    { id: "m0", unlockAfterDays: 0 },
    { id: "m1", unlockAfterDays: 30 },
    { id: "m2", unlockAfterDays: 60 },
  ];

  it("notifies modules unlocked in the look-back window only", () => {
    expect(dueModuleUnlocks(ent, modules, d("2026-01-31T07:00:00Z")).map((m) => m.id)).toEqual([
      "m1",
    ]);
    expect(dueModuleUnlocks(ent, modules, d("2026-01-15T07:00:00Z"))).toEqual([]);
    expect(
      dueModuleUnlocks({ ...ent, status: "revoked" }, modules, d("2026-01-31T07:00:00Z")),
    ).toEqual([]);
  });

  it("picks the 30- and 7-day expiry reminders", () => {
    const e = { ...ent, expiresAt: d("2026-07-01T00:00:00Z") };
    expect(dueExpiryReminder(e, d("2026-05-15T08:00:00Z"))).toBeNull();
    expect(dueExpiryReminder(e, d("2026-06-05T08:00:00Z"))).toEqual({
      threshold: 30,
      daysLeft: 26,
    });
    expect(dueExpiryReminder(e, d("2026-06-26T08:00:00Z"))).toEqual({ threshold: 7, daysLeft: 5 });
    expect(dueExpiryReminder(e, d("2026-07-02T08:00:00Z"))).toBeNull();
    expect(dueExpiryReminder({ ...e, expiresAt: null }, d("2026-06-26T08:00:00Z"))).toBeNull();
  });

  it("dedupe keys change when the expiry date changes (after an extension)", () => {
    expect(expiryDedupeKey("e1", 30, d("2026-07-01T00:00:00Z"))).not.toBe(
      expiryDedupeKey("e1", 30, d("2026-10-01T00:00:00Z")),
    );
  });
});
