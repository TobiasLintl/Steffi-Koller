"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { writeAudit } from "@/server/audit/log";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { runWebhookEffects } from "@/server/payment/effects";
import { isPaymentProvider, paymentAdapter } from "@/server/payment/registry";
import { reprocessWebhookEvent } from "@/server/services/webhooks";

export async function reprocessAction(eventId: string): Promise<ActionState> {
  const actor = await requirePermission("webhooks:read", `/admin/webhooks/${eventId}`);
  const id = z.uuid().parse(eventId);
  const [row] = await db
    .select({ provider: webhookEvents.provider })
    .from(webhookEvents)
    .where(eq(webhookEvents.id, id));
  if (!row || !isPaymentProvider(row.provider))
    return { ok: false, message: "Ereignis nicht gefunden." };
  const adapter = paymentAdapter(row.provider);
  if (!adapter) return { ok: false, message: "Für diesen Reseller ist kein Secret konfiguriert." };
  const outcome = await reprocessWebhookEvent(db, adapter, id);
  await writeAudit(db, {
    action: "webhook.reprocessed",
    actorUserId: actor.id,
    actorRole: actor.role,
    targetType: "webhook_event",
    targetId: id,
    metadata: { outcome: outcome.kind },
  });
  if (outcome.kind === "processed" || outcome.kind === "failed")
    await runWebhookEffects(outcome.effects);
  revalidatePath(`/admin/webhooks/${id}`);
  revalidatePath("/admin/webhooks");
  if (outcome.kind === "failed")
    return { ok: false, message: `Erneut fehlgeschlagen: ${outcome.error}` };
  return {
    ok: true,
    message: outcome.kind === "duplicate" ? "War bereits verarbeitet." : "Erfolgreich verarbeitet.",
  };
}
