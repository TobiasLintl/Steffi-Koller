"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fieldErrorsFrom, type ActionState } from "@/lib/action-state";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { couponInputSchema } from "@/server/domain/catalog/schemas";
import { deleteCoupon, saveCoupon } from "@/server/services/coupons";

function parse(formData: FormData) {
  return couponInputSchema.safeParse({
    ...Object.fromEntries(formData),
    productIds: formData.getAll("productIds"),
    showOnWebsite: formData.get("showOnWebsite") === "on",
    isActive: formData.get("isActive") === "on",
  });
}

export async function saveCouponAction(
  id: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("coupons:write", "/admin/gutscheine");
  const parsed = parse(formData);
  if (!parsed.success)
    return {
      ok: false,
      message: "Bitte prüfe die Eingaben.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  await saveCoupon(db, parsed.data, id ? z.uuid().parse(id) : undefined);
  revalidatePath("/admin/gutscheine");
  revalidatePath("/angebote", "layout");
  return { ok: true, message: "Gespeichert." };
}

export async function deleteCouponAction(id: string): Promise<void> {
  await requirePermission("coupons:write", "/admin/gutscheine");
  await deleteCoupon(db, z.uuid().parse(id));
  revalidatePath("/admin/gutscheine");
}
