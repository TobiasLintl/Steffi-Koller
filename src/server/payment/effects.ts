import "server-only";

import { serverEnv } from "@/server/env";
import { sendMail } from "@/server/mail/send";
import {
  accessExtendedMail,
  accessGrantedMail,
  adminNotificationMail,
} from "@/server/mail/templates";
import type { WebhookEffect } from "@/server/services/webhooks";

/** Runs post-commit side effects. Failures are logged, never undo the booking. */
export async function runWebhookEffects(effects: WebhookEffect[]): Promise<void> {
  const env = serverEnv();
  for (const effect of effects) {
    try {
      if (effect.type === "access_mail") {
        const url = `${env.NEXT_PUBLIC_APP_URL}/konto/kurse/${effect.courseSlug}`;
        const content =
          effect.variant === "granted" || !effect.expiresAt
            ? accessGrantedMail({
                courseTitle: effect.courseTitle,
                url,
                name: effect.name,
                expiresAt: effect.expiresAt,
              })
            : accessExtendedMail({
                courseTitle: effect.courseTitle,
                url,
                name: effect.name,
                expiresAt: effect.expiresAt,
              });
        await sendMail("access_granted", effect.email, content);
      } else if (effect.type === "admin_mail" && env.ADMIN_NOTIFICATION_EMAIL) {
        await sendMail(
          "admin_notification",
          env.ADMIN_NOTIFICATION_EMAIL,
          adminNotificationMail({
            title: effect.title,
            body: effect.body,
            url: `${env.NEXT_PUBLIC_APP_URL}${effect.link}`,
          }),
        );
      }
    } catch (error) {
      console.error(`[webhook] effect ${effect.type} failed`, error);
    }
  }
}
