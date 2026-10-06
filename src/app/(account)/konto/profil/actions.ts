"use server";

import { revalidatePath } from "next/cache";

import { fieldErrorsFrom, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { customerProfiles } from "@/server/db/schema";
import { customerProfileSchema, normalizeProfile } from "@/server/domain/customers/profile";
import { newsletterAdapter } from "@/server/newsletter/registry";
import { unsubscribeEmail } from "@/server/services/newsletter";

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/konto/profil");
  const raw = Object.fromEntries(formData);
  const parsed = customerProfileSchema.safeParse({ ...raw, country: raw.country || null });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Bitte prüfe deine Angaben.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }
  const values = normalizeProfile(parsed.data);
  await db
    .insert(customerProfiles)
    .values({ userId: user.id, ...values, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: customerProfiles.userId,
      set: { ...values, updatedAt: new Date() },
    });
  revalidatePath("/konto/profil");
  return { ok: true, message: "Deine Angaben sind gespeichert." };
}

export async function unsubscribeOwnNewsletter(): Promise<void> {
  const user = await requireUser("/konto/profil");
  await unsubscribeEmail(db, newsletterAdapter(), user.email);
  revalidatePath("/konto/profil");
}
