import { eq } from "drizzle-orm";
import type { z } from "zod";

import { writeAudit } from "@/server/audit/log";
import { appSettings } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import {
  DEFAULT_REFUND_POLICY,
  refundPolicySchema,
  type RefundPolicy,
} from "@/server/domain/orders/refund-policy";
import type { StaffActor } from "./access";

export async function getSetting<T>(
  db: DbExecutor,
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): Promise<T> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  if (!row) return fallback;
  const parsed = schema.safeParse(row.value);
  return parsed.success ? parsed.data : fallback;
}

export async function setSetting<T>(
  db: DbExecutor,
  actor: StaffActor,
  key: string,
  schema: z.ZodType<T>,
  value: T,
): Promise<void> {
  const parsed = schema.parse(value);
  await db.transaction(async (tx) => {
    await tx
      .insert(appSettings)
      .values({ key, value: parsed, updatedBy: actor.id })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: parsed, updatedAt: new Date(), updatedBy: actor.id },
      });
    await writeAudit(tx, {
      action: "settings.changed",
      actorUserId: actor.id,
      actorRole: actor.role,
      targetType: "setting",
      targetId: key,
      metadata: { value: parsed },
    });
  });
}

export const REFUND_POLICY_KEY = "refund_policy";

export function getRefundPolicy(db: DbExecutor): Promise<RefundPolicy> {
  return getSetting(db, REFUND_POLICY_KEY, refundPolicySchema, DEFAULT_REFUND_POLICY);
}
