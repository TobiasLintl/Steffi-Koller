import { auditLog } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";

/** Audit actions required by CLAUDE.md §6. Keep names stable; they are filterable in the admin. */
export type AuditAction =
  | "admin.login"
  | "role.changed"
  | "staff.invited"
  | "entitlement.granted"
  | "entitlement.extended"
  | "entitlement.revoked"
  | "entitlement.reinstated"
  | "export.created"
  | "report.approved"
  | "report.published"
  | "account.deleted"
  | "media.deleted"
  | "course.deleted"
  | "product.created"
  | "product.updated"
  | "product.deleted"
  | "product.mapping_changed"
  | "webhook.reprocessed"
  | "settings.changed"
  | "backup.restored";

export interface AuditEntry {
  action: AuditAction;
  actorUserId?: string | null;
  actorRole?: string | null;
  targetType?: string;
  targetId?: string;
  reason?: string;
  /** Never put plain e-mail addresses or names here (CLAUDE.md §6). */
  metadata?: Record<string, unknown>;
}

export async function writeAudit(db: DbExecutor, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    action: entry.action,
    actorUserId: entry.actorUserId ?? null,
    actorRole: entry.actorRole ?? null,
    targetType: entry.targetType,
    targetId: entry.targetId,
    reason: entry.reason,
    metadata: entry.metadata,
  });
}
