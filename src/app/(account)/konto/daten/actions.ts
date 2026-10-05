"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { newsletterAdapter } from "@/server/newsletter/registry";
import { deleteAccount, PrivacyError } from "@/server/services/privacy";

export async function deleteOwnAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/konto/daten");
  if (
    String(formData.get("confirmEmail") ?? "")
      .trim()
      .toLowerCase() !== user.email.toLowerCase()
  ) {
    return { ok: false, message: "Bitte gib zur Bestätigung deine E-Mail-Adresse ein." };
  }
  try {
    await deleteAccount(
      db,
      { newsletter: newsletterAdapter() },
      { userId: user.id, actor: { id: user.id, role: user.role }, reason: "Selbst gelöscht" },
    );
  } catch (error) {
    if (error instanceof PrivacyError) return { ok: false, message: error.message };
    throw error;
  }
  const jar = await cookies();
  for (const c of jar.getAll()) if (c.name.includes("better-auth")) jar.delete(c.name);
  redirect("/konto-geloescht");
}
