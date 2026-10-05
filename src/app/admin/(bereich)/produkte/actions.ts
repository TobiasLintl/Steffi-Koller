"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fieldErrorsFrom, type ActionState } from "@/lib/action-state";
import { PAYMENT_PROVIDERS } from "@/server/adapters/payment";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { addProductMapping, removeProductMapping } from "@/server/services/products";

const mappingSchema = z.object({
  productId: z.uuid(),
  provider: z.enum(PAYMENT_PROVIDERS),
  providerProductId: z
    .string()
    .trim()
    .min(1, "Bitte die Produkt-ID des Resellers angeben.")
    .max(100),
});

export async function addMappingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("products:write", "/admin/produkte");
  const parsed = mappingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const result = await addProductMapping(db, actor, parsed.data);
  revalidatePath("/admin/produkte");
  return result === "taken"
    ? { ok: false, message: "Diese Reseller-Produkt-ID ist bereits einem Produkt zugeordnet." }
    : { ok: true, message: "Zuordnung gespeichert." };
}

export async function removeMappingAction(mappingId: string): Promise<void> {
  const actor = await requirePermission("products:write", "/admin/produkte");
  await removeProductMapping(db, actor, z.uuid().parse(mappingId));
  revalidatePath("/admin/produkte");
}
