import { maskEmail } from "@/server/adapters/mail/log";
import type { NewsletterAdapter } from "./types";

/** Development driver: logs sync calls instead of contacting a provider. */
export function createLogNewsletterAdapter(): NewsletterAdapter {
  return {
    async upsertConfirmedContact(contact) {
      console.info(
        `[newsletter] upsert ${maskEmail(contact.email)} (consent ${contact.consent.consentTextVersion})`,
      );
    },
    async unsubscribe(email) {
      console.info(`[newsletter] unsubscribe ${maskEmail(email)}`);
    },
  };
}
