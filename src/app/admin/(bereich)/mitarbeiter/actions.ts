"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fieldErrorsFrom, type ActionState } from "@/lib/action-state";
import { getAuth } from "@/server/auth/auth";
import { STAFF_ROLES, ROLES } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { changeRole, inviteStaff, StaffError } from "@/server/services/staff";

const inviteSchema = z.object({
  email: z.email("Bitte eine gültige E-Mail-Adresse angeben."),
  name: z.string().trim().min(2, "Bitte den Namen angeben.").max(100),
  role: z.enum(STAFF_ROLES as [string, ...string[]]),
});

export async function inviteStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("staff:manage", "/admin/mitarbeiter");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  try {
    await inviteStaff(
      db,
      actor,
      parsed.data as { email: string; name: string; role: (typeof STAFF_ROLES)[number] },
    );
  } catch (error) {
    if (error instanceof StaffError) return { ok: false, message: error.message };
    throw error;
  }
  // Invitation = password-set link (sent as invitation mail for staff without password).
  await getAuth().api.requestPasswordReset({
    body: { email: parsed.data.email.toLowerCase(), redirectTo: "/passwort-zuruecksetzen" },
  });
  revalidatePath("/admin/mitarbeiter");
  return { ok: true, message: "Einladung verschickt." };
}

const roleSchema = z.object({
  role: z.enum(ROLES as unknown as [string, ...string[]]),
  reason: z.string().trim().min(3, "Bitte eine Begründung angeben.").max(300),
});

export async function changeRoleAction(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermission("staff:manage", "/admin/mitarbeiter");
  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  try {
    await changeRole(
      db,
      actor,
      z.string().min(1).parse(userId),
      parsed.data.role as (typeof ROLES)[number],
      parsed.data.reason,
    );
  } catch (error) {
    if (error instanceof StaffError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/admin/mitarbeiter");
  return {
    ok: true,
    message:
      parsed.data.role === "customer" ? "Zugang zum Adminbereich entzogen." : "Rolle geändert.",
  };
}
