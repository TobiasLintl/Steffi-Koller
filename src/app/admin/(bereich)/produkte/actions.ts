"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fieldErrorsFrom, type ActionState } from "@/lib/action-state";
import { PAYMENT_PROVIDERS } from "@/server/adapters/payment";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { productInputSchema } from "@/server/domain/catalog/schemas";
import {
  addProductMapping,
  CatalogError,
  createProduct,
  deleteProduct,
  removeProductMapping,
  updateProduct,
} from "@/server/services/products";
import { redirect } from "next/navigation";

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

function parseProduct(formData: FormData) {
  return productInputSchema.safeParse({
    ...Object.fromEntries(formData),
    isPublished: formData.get("isPublished") === "on",
  });
}

export async function createProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("products:write", "/admin/produkte");
  const parsed = parseProduct(formData);
  if (!parsed.success)
    return {
      ok: false,
      message: "Bitte prüfe die Eingaben.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  let id: string;
  try {
    id = await createProduct(db, actor, parsed.data);
  } catch (error) {
    if (error instanceof CatalogError) return { ok: false, message: error.message };
    throw error;
  }
  redirect(`/admin/produkte/${id}`);
}

export async function updateProductAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("products:write", "/admin/produkte");
  const parsed = parseProduct(formData);
  if (!parsed.success)
    return {
      ok: false,
      message: "Bitte prüfe die Eingaben.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  try {
    await updateProduct(db, actor, z.uuid().parse(id), parsed.data);
  } catch (error) {
    if (error instanceof CatalogError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/admin/produkte");
  revalidatePath(`/angebote/${parsed.data.slug}`);
  return { ok: true, message: "Gespeichert." };
}

export async function deleteProductAction(id: string): Promise<ActionState> {
  const actor = await requirePermission("products:write", "/admin/produkte");
  try {
    await deleteProduct(db, actor, z.uuid().parse(id));
  } catch (error) {
    if (error instanceof CatalogError) return { ok: false, message: error.message };
    throw error;
  }
  redirect("/admin/produkte");
}
