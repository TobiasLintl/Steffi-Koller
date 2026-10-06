import { desc, isNull, sql } from "drizzle-orm";

import { adminNotifications } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";

export interface AdminNotificationInput {
  kind: string;
  title: string;
  /** No plain customer e-mail addresses or names (CLAUDE.md §6). */
  body: string;
  link?: string;
}

export async function createAdminNotification(
  db: DbExecutor,
  input: AdminNotificationInput,
): Promise<void> {
  await db.insert(adminNotifications).values(input);
}

export async function listAdminNotifications(db: DbExecutor, limit = 20) {
  return db
    .select()
    .from(adminNotifications)
    .orderBy(desc(adminNotifications.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(db: DbExecutor): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(adminNotifications)
    .where(isNull(adminNotifications.readAt));
  return row?.n ?? 0;
}
