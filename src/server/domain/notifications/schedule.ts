import { moduleUnlocksAt } from "@/server/domain/access/drip";
import { entitlementState, type EntitlementSnapshot } from "@/server/domain/access/entitlement";

/** Days before expiry at which a reminder with an extension link is sent. */
export const EXPIRY_REMINDER_DAYS = [30, 7] as const;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Modules whose drip date passed within the look-back window. Modules available from day 0
 * are covered by the access mail and never notified separately.
 */
export function dueModuleUnlocks<M extends { id: string; unlockAfterDays: number }>(
  ent: EntitlementSnapshot,
  modules: M[],
  now: Date,
  lookbackHours = 36,
): M[] {
  if (entitlementState(ent, now) !== "active") return [];
  const from = now.getTime() - lookbackHours * 60 * 60 * 1000;
  return modules.filter((m) => {
    if (m.unlockAfterDays <= 0) return false;
    const at = moduleUnlocksAt(ent, m).getTime();
    return at > from && at <= now.getTime();
  });
}

/**
 * The reminder threshold that is due now (smallest matching one), or null.
 * Dedupe per threshold and expiry date, so an extension later triggers new reminders.
 */
export function dueExpiryReminder(
  ent: EntitlementSnapshot,
  now: Date,
): { threshold: number; daysLeft: number } | null {
  if (entitlementState(ent, now) !== "active" || !ent.expiresAt) return null;
  const daysLeft = Math.ceil((ent.expiresAt.getTime() - now.getTime()) / DAY);
  const due = [...EXPIRY_REMINDER_DAYS].sort((a, b) => a - b).find((t) => daysLeft <= t);
  return due === undefined ? null : { threshold: due, daysLeft };
}

export function expiryDedupeKey(entitlementId: string, threshold: number, expiresAt: Date): string {
  return `expiry_reminder:${entitlementId}:${threshold}:${expiresAt.toISOString().slice(0, 10)}`;
}

export function moduleUnlockDedupeKey(entitlementId: string, moduleId: string): string {
  return `module_unlocked:${entitlementId}:${moduleId}`;
}
