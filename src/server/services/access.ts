import { and, eq } from "drizzle-orm";

import { writeAudit } from "@/server/audit/log";
import type { Role } from "@/server/auth/permissions";
import { entitlementEvents, entitlements } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import { extendedExpiry, initialExpiry } from "@/server/domain/access";

/**
 * Entitlement use-cases. Every change runs in a transaction with a row lock, so concurrent
 * webhooks or admin actions can never create a second record or double an extension.
 */

type Source = "purchase" | "manual" | "free";

export interface AccessChange {
  entitlementId: string;
  result: "granted" | "extended" | "reinstated" | "revoked" | "unchanged" | "skipped_revoked";
  expiresAt: Date | null;
}

interface CommonInput {
  userId: string;
  courseId: string;
  now?: Date;
  actorUserId?: string | null;
  orderId?: string | null;
  reason?: string | null;
}

async function lockEntitlement(tx: DbExecutor, userId: string, courseId: string) {
  const [row] = await tx
    .select()
    .from(entitlements)
    .where(and(eq(entitlements.userId, userId), eq(entitlements.courseId, courseId)))
    .for("update");
  return row;
}

/**
 * Grants access for `accessMonths` (null = unlimited). An existing active entitlement is
 * extended instead (no second record); a revoked one is reinstated with a fresh period.
 */
export async function grantAccess(
  db: DbExecutor,
  input: CommonInput & { accessMonths: number | null; source: Source },
): Promise<AccessChange> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    // Make sure a row exists, then lock it. ON CONFLICT keeps this race-free.
    const inserted = await tx
      .insert(entitlements)
      .values({
        userId: input.userId,
        courseId: input.courseId,
        source: input.source,
        startsAt: now,
        expiresAt: initialExpiry(now, input.accessMonths),
      })
      .onConflictDoNothing({ target: [entitlements.userId, entitlements.courseId] })
      .returning();

    if (inserted[0]) {
      await tx.insert(entitlementEvents).values({
        entitlementId: inserted[0].id,
        type: "granted",
        newExpiresAt: inserted[0].expiresAt,
        actorUserId: input.actorUserId,
        orderId: input.orderId,
        reason: input.reason,
      });
      return { entitlementId: inserted[0].id, result: "granted", expiresAt: inserted[0].expiresAt };
    }

    const current = await lockEntitlement(tx, input.userId, input.courseId);
    if (!current) throw new Error("Entitlement vanished during grant");

    if (current.status === "revoked") {
      const expiresAt = initialExpiry(now, input.accessMonths);
      await tx
        .update(entitlements)
        .set({ status: "active", startsAt: now, expiresAt, source: input.source, updatedAt: now })
        .where(eq(entitlements.id, current.id));
      await tx.insert(entitlementEvents).values({
        entitlementId: current.id,
        type: "reinstated",
        previousExpiresAt: current.expiresAt,
        newExpiresAt: expiresAt,
        actorUserId: input.actorUserId,
        orderId: input.orderId,
        reason: input.reason,
      });
      return { entitlementId: current.id, result: "reinstated", expiresAt };
    }

    const expiresAt =
      input.accessMonths === null
        ? null
        : extendedExpiry(current.expiresAt, now, input.accessMonths);
    await tx
      .update(entitlements)
      .set({ expiresAt, updatedAt: now })
      .where(eq(entitlements.id, current.id));
    await tx.insert(entitlementEvents).values({
      entitlementId: current.id,
      type: "extended",
      previousExpiresAt: current.expiresAt,
      newExpiresAt: expiresAt,
      actorUserId: input.actorUserId,
      orderId: input.orderId,
      reason: input.reason,
    });
    return { entitlementId: current.id, result: "extended", expiresAt };
  });
}

/**
 * Extension purchase (AK-06): expires_at = max(expires_at, now) + months on the existing
 * record. Without an entitlement, access is granted for `months`. Revoked entitlements are
 * not touched (the caller notifies the admin).
 */
export async function extendAccess(
  db: DbExecutor,
  input: CommonInput & { months: number; source: Source },
): Promise<AccessChange> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const current = await lockEntitlement(tx, input.userId, input.courseId);
    if (!current) {
      return grantAccess(tx, { ...input, accessMonths: input.months });
    }
    if (current.status === "revoked") {
      return { entitlementId: current.id, result: "skipped_revoked", expiresAt: current.expiresAt };
    }
    const expiresAt = extendedExpiry(current.expiresAt, now, input.months);
    await tx
      .update(entitlements)
      .set({ expiresAt, updatedAt: now })
      .where(eq(entitlements.id, current.id));
    await tx.insert(entitlementEvents).values({
      entitlementId: current.id,
      type: "extended",
      previousExpiresAt: current.expiresAt,
      newExpiresAt: expiresAt,
      actorUserId: input.actorUserId,
      orderId: input.orderId,
      reason: input.reason,
    });
    return { entitlementId: current.id, result: "extended", expiresAt };
  });
}

/** Blocks access immediately; content stays visible as "gesperrt" in the account. */
export async function revokeAccess(
  db: DbExecutor,
  input: CommonInput & { now?: Date },
): Promise<AccessChange> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const current = await lockEntitlement(tx, input.userId, input.courseId);
    if (!current) throw new AccessError("not_found");
    if (current.status === "revoked") {
      return { entitlementId: current.id, result: "unchanged", expiresAt: current.expiresAt };
    }
    await tx
      .update(entitlements)
      .set({ status: "revoked", updatedAt: now })
      .where(eq(entitlements.id, current.id));
    await tx.insert(entitlementEvents).values({
      entitlementId: current.id,
      type: "revoked",
      previousExpiresAt: current.expiresAt,
      newExpiresAt: current.expiresAt,
      actorUserId: input.actorUserId,
      orderId: input.orderId,
      reason: input.reason,
    });
    return { entitlementId: current.id, result: "revoked", expiresAt: current.expiresAt };
  });
}

export class AccessError extends Error {
  constructor(readonly code: "not_found") {
    super(`Access change failed: ${code}`);
  }
}

/* ---------- Manual admin changes: always with reason + audit log (CLAUDE.md §5.1) ---------- */

export interface StaffActor {
  id: string;
  role: Role;
}

export async function adminGrantAccess(
  db: DbExecutor,
  actor: StaffActor,
  input: {
    userId: string;
    courseId: string;
    accessMonths: number | null;
    reason: string;
    now?: Date;
  },
): Promise<AccessChange> {
  return db.transaction(async (tx) => {
    const change = await grantAccess(tx, { ...input, source: "manual", actorUserId: actor.id });
    await writeAudit(tx, {
      action: change.result === "extended" ? "entitlement.extended" : "entitlement.granted",
      actorUserId: actor.id,
      actorRole: actor.role,
      targetType: "entitlement",
      targetId: change.entitlementId,
      reason: input.reason,
      metadata: {
        userId: input.userId,
        courseId: input.courseId,
        result: change.result,
        expiresAt: change.expiresAt,
      },
    });
    return change;
  });
}

export async function adminExtendAccess(
  db: DbExecutor,
  actor: StaffActor,
  input: { userId: string; courseId: string; months: number; reason: string; now?: Date },
): Promise<AccessChange> {
  return db.transaction(async (tx) => {
    const change = await extendAccess(tx, { ...input, source: "manual", actorUserId: actor.id });
    await writeAudit(tx, {
      action: "entitlement.extended",
      actorUserId: actor.id,
      actorRole: actor.role,
      targetType: "entitlement",
      targetId: change.entitlementId,
      reason: input.reason,
      metadata: {
        userId: input.userId,
        courseId: input.courseId,
        result: change.result,
        expiresAt: change.expiresAt,
      },
    });
    return change;
  });
}

export async function adminRevokeAccess(
  db: DbExecutor,
  actor: StaffActor,
  input: { userId: string; courseId: string; reason: string; now?: Date },
): Promise<AccessChange> {
  return db.transaction(async (tx) => {
    const change = await revokeAccess(tx, { ...input, actorUserId: actor.id });
    await writeAudit(tx, {
      action: "entitlement.revoked",
      actorUserId: actor.id,
      actorRole: actor.role,
      targetType: "entitlement",
      targetId: change.entitlementId,
      reason: input.reason,
      metadata: { userId: input.userId, courseId: input.courseId, result: change.result },
    });
    return change;
  });
}
