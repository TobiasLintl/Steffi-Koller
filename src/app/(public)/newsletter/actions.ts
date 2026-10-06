"use server";

import { headers } from "next/headers";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { clientIp, createRateLimiter } from "@/server/http/rate-limit";
import { newsletterAdapter, newsletterDeps } from "@/server/newsletter/registry";
import {
  confirmNewsletter,
  subscribeNewsletter,
  unsubscribeByToken,
} from "@/server/services/newsletter";

const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 5 });

const schema = z.object({
  email: z.email("Bitte gib eine gültige E-Mail-Adresse an.").max(200),
  consent: z.literal("on", { message: "Bitte bestätige deine Einwilligung." }),
  source: z.enum(["website", "gratis", "account", "start"]).default("website"),
});

export async function subscribeNewsletterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ip = clientIp(await headers());
  if (!limiter(ip)) return { ok: false, message: "Zu viele Versuche – bitte später noch einmal." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Bitte prüfe deine Angaben." };
  const user = await getCurrentUser();
  await subscribeNewsletter(db, newsletterDeps(), {
    email: parsed.data.email,
    source: parsed.data.source,
    ip,
    userId: user?.email === parsed.data.email.toLowerCase() ? user.id : null,
  });
  return {
    ok: true,
    message:
      "Fast geschafft! Bitte bestätige deine Anmeldung über den Link in der E-Mail, die wir dir gerade geschickt haben.",
  };
}

export async function confirmNewsletterAction(token: string): Promise<ActionState> {
  const result = await confirmNewsletter(db, newsletterDeps(), {
    token,
    ip: clientIp(await headers()),
  });
  if (result === "invalid")
    return {
      ok: false,
      message: "Dieser Link ist ungültig oder abgelaufen. Melde dich gern einfach neu an.",
    };
  return { ok: true, message: "Danke! Deine Anmeldung ist bestätigt. Schön, dass du dabei bist." };
}

export async function unsubscribeNewsletterAction(token: string): Promise<ActionState> {
  const ok = await unsubscribeByToken(db, newsletterAdapter(), token);
  return ok
    ? { ok: true, message: "Du bist abgemeldet und erhältst keinen Newsletter mehr." }
    : { ok: false, message: "Dieser Link ist ungültig." };
}
