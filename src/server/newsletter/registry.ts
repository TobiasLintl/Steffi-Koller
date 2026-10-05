import "server-only";

import {
  createBrevoNewsletterAdapter,
  createLogNewsletterAdapter,
  type NewsletterAdapter,
} from "@/server/adapters/newsletter";
import { serverEnv } from "@/server/env";
import { mailAdapter } from "@/server/mail/send";
import type { NewsletterDeps } from "@/server/services/newsletter";

let instance: NewsletterAdapter | undefined;

export function newsletterAdapter(): NewsletterAdapter {
  if (instance) return instance;
  const env = serverEnv();
  instance =
    env.NEWSLETTER_DRIVER === "brevo"
      ? createBrevoNewsletterAdapter({
          apiKey: env.BREVO_API_KEY!,
          listId: env.BREVO_NEWSLETTER_LIST_ID!,
        })
      : createLogNewsletterAdapter();
  return instance;
}

export function newsletterDeps(): NewsletterDeps {
  return {
    mail: mailAdapter(),
    newsletter: newsletterAdapter(),
    appUrl: serverEnv().NEXT_PUBLIC_APP_URL,
  };
}
