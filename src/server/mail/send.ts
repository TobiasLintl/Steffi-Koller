import "server-only";

import {
  createBrevoMailAdapter,
  createLogMailAdapter,
  type MailAdapter,
  type TransactionalMailKind,
} from "@/server/adapters/mail";
import { serverEnv } from "@/server/env";
import type { MailContent } from "./layout";

let adapter: MailAdapter | undefined;

export function mailAdapter(): MailAdapter {
  if (adapter) return adapter;
  const env = serverEnv();
  if (env.MAIL_DRIVER === "brevo") {
    if (!env.BREVO_API_KEY) throw new Error("BREVO_API_KEY is required for MAIL_DRIVER=brevo");
    adapter = createBrevoMailAdapter({
      apiKey: env.BREVO_API_KEY,
      senderEmail: env.MAIL_FROM_SUPPORT,
      senderName: env.MAIL_SENDER_NAME,
    });
  } else {
    adapter = createLogMailAdapter();
  }
  return adapter;
}

/** Test hook. */
export function setMailAdapter(next: MailAdapter | undefined): void {
  adapter = next;
}

export async function sendMail(
  kind: TransactionalMailKind,
  to: string,
  content: MailContent,
): Promise<{ messageId: string }> {
  return mailAdapter().send({ kind, to, ...content, replyTo: serverEnv().MAIL_FROM_SUPPORT });
}
