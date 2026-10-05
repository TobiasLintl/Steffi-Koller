"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { refundPolicySchema } from "@/server/domain/orders/refund-policy";
import { REFUND_POLICY_KEY, setSetting } from "@/server/services/settings";

export async function saveRefundPolicyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("settings:write", "/admin/einstellungen");
  const parsed = refundPolicySchema.safeParse({
    action: formData.get("action"),
    notifyAdmin: formData.get("notifyAdmin") === "on",
  });
  if (!parsed.success) return { ok: false, message: "Ungültige Auswahl." };
  await setSetting(db, actor, REFUND_POLICY_KEY, refundPolicySchema, parsed.data);
  revalidatePath("/admin/einstellungen");
  return { ok: true, message: "Gespeichert." };
}
