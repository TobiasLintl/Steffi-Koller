import { addDays } from "./dates";
import { entitlementState, type EntitlementSnapshot } from "./entitlement";

export interface DripModule {
  /** Days after entitlement.startsAt; 0 = immediately. */
  unlockAfterDays: number;
}

/**
 * DECISION D-03: until decided, drip always counts from the original entitlement.startsAt –
 * an extension before the drip has finished does not shift or reset unlock dates.
 */
export function moduleUnlocksAt(ent: Pick<EntitlementSnapshot, "startsAt">, mod: DripModule): Date {
  return addDays(ent.startsAt, Math.max(0, mod.unlockAfterDays));
}

export function isModuleUnlocked(
  ent: Pick<EntitlementSnapshot, "startsAt">,
  mod: DripModule,
  now: Date,
): boolean {
  return moduleUnlocksAt(ent, mod).getTime() <= now.getTime();
}

export type LessonAccess =
  | { allowed: true }
  | {
      allowed: false;
      reason: "no_entitlement" | "expired" | "revoked" | "locked";
      unlocksAt?: Date;
    };

/** Single source of truth for "may this user open this lesson now?" (computed on read, §5.2). */
export function lessonAccess(
  ent: EntitlementSnapshot | null | undefined,
  mod: DripModule,
  now: Date,
): LessonAccess {
  if (!ent) return { allowed: false, reason: "no_entitlement" };
  const state = entitlementState(ent, now);
  if (state !== "active") return { allowed: false, reason: state };
  if (!isModuleUnlocked(ent, mod, now)) {
    return { allowed: false, reason: "locked", unlocksAt: moduleUnlocksAt(ent, mod) };
  }
  return { allowed: true };
}
