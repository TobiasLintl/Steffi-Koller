import { randomUUID } from "node:crypto";

import { and, asc, eq, ne, sql } from "drizzle-orm";

import { writeAudit } from "@/server/audit/log";
import { isRole, isStaffRole, type Role } from "@/server/auth/permissions";
import { accounts, customerProfiles, sessions, users } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import type { StaffActor } from "./access";

export class StaffError extends Error {}

export async function listStaff(db: DbExecutor) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      twoFactorEnabled: users.twoFactorEnabled,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(ne(users.role, "customer"))
    .orderBy(asc(users.name));
}

async function adminCount(db: DbExecutor): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "admin"));
  return row?.n ?? 0;
}

/**
 * Creates (or promotes) a staff account. The caller then sends the invitation link
 * (password set via the reset flow); 2FA enrolment is enforced on first admin access.
 */
export async function inviteStaff(
  db: DbExecutor,
  actor: StaffActor,
  input: { email: string; name: string; role: Role },
): Promise<{ userId: string; created: boolean }> {
  if (!isStaffRole(input.role)) throw new StaffError("Bitte eine Mitarbeiterrolle wählen.");
  const email = input.email.trim().toLowerCase();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.email, email));
    if (existing && existing.role !== "customer")
      throw new StaffError("Diese Person ist bereits als Mitarbeiter:in eingetragen.");
    let userId = existing?.id;
    if (existing) {
      await tx
        .update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(users.id, existing.id));
    } else {
      userId = randomUUID();
      // The invitation link proves ownership of the address before the first sign-in.
      await tx
        .insert(users)
        .values({ id: userId, email, name: input.name, role: input.role, emailVerified: true });
      await tx.insert(customerProfiles).values({ userId });
    }
    await writeAudit(tx, {
      action: "staff.invited",
      actorUserId: actor.id,
      actorRole: actor.role,
      targetType: "user",
      targetId: userId!,
      metadata: { role: input.role, previousRole: existing?.role ?? null },
    });
    return { userId: userId!, created: !existing };
  });
}

export async function changeRole(
  db: DbExecutor,
  actor: StaffActor,
  userId: string,
  role: Role,
  reason: string,
): Promise<void> {
  if (!isRole(role)) throw new StaffError("Unbekannte Rolle.");
  if (userId === actor.id) throw new StaffError("Die eigene Rolle kann nicht geändert werden.");
  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!target) throw new StaffError("Konto nicht gefunden.");
    if (target.role === "admin" && role !== "admin" && (await adminCount(tx)) <= 1) {
      throw new StaffError("Es muss mindestens ein Admin-Konto bestehen bleiben.");
    }
    await tx.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
    // Role changes take effect immediately: end all sessions of the account.
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await writeAudit(tx, {
      action: "role.changed",
      actorUserId: actor.id,
      actorRole: actor.role,
      targetType: "user",
      targetId: userId,
      reason,
      metadata: { from: target.role, to: role },
    });
  });
}

export async function hasCredentialAccount(db: DbExecutor, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")));
  return Boolean(row);
}

export async function isStaffUser(
  db: DbExecutor,
  email: string,
): Promise<{ id: string; role: string } | undefined> {
  const [row] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), ne(users.role, "customer")));
  return row;
}
