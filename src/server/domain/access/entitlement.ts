import { addMonths, maxDate } from "./dates";

export type EntitlementStatus = "active" | "revoked";

export interface EntitlementSnapshot {
  status: EntitlementStatus;
  startsAt: Date;
  /** null = unlimited. */
  expiresAt: Date | null;
}

export type EntitlementState = "active" | "expired" | "revoked";

export function entitlementState(ent: EntitlementSnapshot, now: Date): EntitlementState {
  if (ent.status === "revoked") return "revoked";
  if (ent.expiresAt && ent.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

/** Initial expiry for a new entitlement; null months = unlimited (e.g. free products). */
export function initialExpiry(startsAt: Date, accessMonths: number | null): Date | null {
  if (accessMonths === null) return null;
  assertPositiveMonths(accessMonths);
  return addMonths(startsAt, accessMonths);
}

/**
 * Extension rule (CLAUDE.md §5.1, AK-06): expires_at = max(expires_at, now) + months.
 * Extending an unlimited entitlement keeps it unlimited.
 */
export function extendedExpiry(current: Date | null, now: Date, months: number): Date | null {
  assertPositiveMonths(months);
  if (current === null) return null;
  return addMonths(maxDate(current, now), months);
}

function assertPositiveMonths(months: number): void {
  if (!Number.isInteger(months) || months <= 0) {
    throw new Error(`Access duration must be a positive number of months, got ${months}`);
  }
}
