import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { auditLog, users } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";

export interface AuditFilter {
  action?: string;
  actorUserId?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
}

export async function listAuditEntries(
  db: DbExecutor,
  filter: AuditFilter,
  page = 0,
  pageSize = 50,
) {
  const conditions: SQL[] = [];
  if (filter.action) conditions.push(eq(auditLog.action, filter.action));
  if (filter.actorUserId) conditions.push(eq(auditLog.actorUserId, filter.actorUserId));
  if (filter.targetId) conditions.push(eq(auditLog.targetId, filter.targetId));
  if (filter.from) conditions.push(gte(auditLog.occurredAt, filter.from));
  if (filter.to) conditions.push(lte(auditLog.occurredAt, filter.to));
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select({ entry: auditLog, actorName: users.name })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(where)
    .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
    .limit(pageSize + 1)
    .offset(page * pageSize);
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function distinctAuditActions(db: DbExecutor): Promise<string[]> {
  const rows = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .groupBy(auditLog.action)
    .orderBy(auditLog.action);
  return rows.map((r) => r.action);
}

export async function auditActors(db: DbExecutor) {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      sql`${users.id} in (select distinct actor_user_id from audit_log where actor_user_id is not null)`,
    );
}
