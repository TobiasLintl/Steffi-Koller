import { bigserial, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Append-only audit log (CLAUDE.md §6). UPDATE/DELETE are blocked by a database trigger.
 * No foreign keys on purpose: entries must survive deletion/anonymisation of the actor.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actorUserId: text(),
    actorRole: text(),
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    reason: text(),
    metadata: jsonb().$type<Record<string, unknown>>(),
  },
  (t) => [
    index("audit_log_occurred_at_idx").on(t.occurredAt),
    index("audit_log_action_idx").on(t.action),
    index("audit_log_target_idx").on(t.targetType, t.targetId),
    index("audit_log_actor_idx").on(t.actorUserId),
  ],
);
