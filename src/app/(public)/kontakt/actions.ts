"use server";

import { headers } from "next/headers";

import { fieldErrorsFrom, type ActionState } from "@/lib/action-state";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { clientIp, createRateLimiter } from "@/server/http/rate-limit";
import { renderMail } from "@/server/mail/layout";
import { sendMail } from "@/server/mail/send";
import { contactSchema, createContactMessage } from "@/server/services/contact";

const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 5 });

export async function sendContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Honeypot: real people never fill this hidden field.
  if (formData.get("website")) return { ok: true, message: "Danke! Wir melden uns bald bei dir." };
  if (!limiter(clientIp(await headers())))
    return { ok: false, message: "Zu viele Nachrichten – bitte versuche es später noch einmal." };

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      ok: false,
      message: "Bitte prüfe deine Angaben.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };

  const user = await getCurrentUser();
  const id = await createContactMessage(db, parsed.data, user?.id);
  const env = serverEnv();
  await sendMail(
    "support",
    env.MAIL_FROM_SUPPORT,
    renderMail({
      subject: `[Kontakt] ${parsed.data.subject}`,
      greeting: "Hallo,",
      paragraphs: [{ text: "über das Kontaktformular ist eine neue Nachricht eingegangen." }],
      action: {
        label: "Nachricht öffnen",
        url: `${env.NEXT_PUBLIC_APP_URL}/admin/nachrichten#${id}`,
      },
    }),
  ).catch((error: unknown) => console.error("[contact] notification failed", error));

  return {
    ok: true,
    message: "Danke für deine Nachricht! Wir melden uns so bald wie möglich bei dir.",
  };
}
