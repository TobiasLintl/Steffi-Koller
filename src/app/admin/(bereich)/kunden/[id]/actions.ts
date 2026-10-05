"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fieldErrorsFrom, type ActionState } from "@/lib/action-state";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { adminExtendAccess, adminGrantAccess, adminRevokeAccess } from "@/server/services/access";
import { addSupportNote } from "@/server/services/customers";

const reason = z.string().trim().min(3, "Bitte gib eine Begründung an.").max(500);

const grantSchema = z.object({
  courseId: z.uuid("Bitte wähle einen Kurs."),
  months: z.string().regex(/^(unlimited|\d{1,3})$/, "Ungültige Dauer."),
  reason,
});

const extendSchema = z.object({
  courseId: z.uuid(),
  months: z.coerce.number().int().min(1, "Mindestens 1 Monat.").max(120),
  reason,
});

const revokeSchema = z.object({ courseId: z.uuid(), reason });

export async function grantAccessAction(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("entitlements:write", `/admin/kunden/${userId}`);
  const parsed = grantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const months = parsed.data.months === "unlimited" ? null : Number(parsed.data.months);
  if (months !== null && months < 1)
    return { ok: false, fieldErrors: { months: "Mindestens 1 Monat." } };
  const change = await adminGrantAccess(db, actor, {
    userId,
    courseId: parsed.data.courseId,
    accessMonths: months,
    reason: parsed.data.reason,
  });
  revalidatePath(`/admin/kunden/${userId}`);
  return {
    ok: true,
    message:
      change.result === "extended"
        ? "Bestehender Zugang wurde verlängert."
        : "Zugang wurde freigeschaltet.",
  };
}

export async function extendAccessAction(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("entitlements:write", `/admin/kunden/${userId}`);
  const parsed = extendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const change = await adminExtendAccess(db, actor, { userId, ...parsed.data });
  revalidatePath(`/admin/kunden/${userId}`);
  return change.result === "skipped_revoked"
    ? { ok: false, message: "Der Zugang ist gesperrt. Bitte zuerst neu freischalten." }
    : { ok: true, message: "Zugang wurde verlängert." };
}

export async function revokeAccessAction(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("entitlements:write", `/admin/kunden/${userId}`);
  const parsed = revokeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  await adminRevokeAccess(db, actor, { userId, ...parsed.data });
  revalidatePath(`/admin/kunden/${userId}`);
  return { ok: true, message: "Zugang wurde gesperrt." };
}

export async function addSupportNoteAction(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("support:write", `/admin/kunden/${userId}`);
  const note = z
    .string()
    .trim()
    .min(2, "Bitte eine Notiz eingeben.")
    .max(5000)
    .safeParse(formData.get("note"));
  if (!note.success) return { ok: false, message: note.error.issues[0]?.message };
  await addSupportNote(db, { userId, authorId: actor.id, authorName: actor.name, note: note.data });
  revalidatePath(`/admin/kunden/${userId}`);
  return { ok: true, message: "Notiz gespeichert." };
}
