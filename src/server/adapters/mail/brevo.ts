import type { MailAdapter } from "./types";

const BREVO_SMTP_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export interface BrevoMailConfig {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  fetchImpl?: typeof fetch;
}

/** Transactional mail via Brevo's HTTP API (DECISION D-05). */
export function createBrevoMailAdapter(config: BrevoMailConfig): MailAdapter {
  const doFetch = config.fetchImpl ?? fetch;
  return {
    async send(mail) {
      const response = await doFetch(BREVO_SMTP_ENDPOINT, {
        method: "POST",
        headers: {
          "api-key": config.apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { email: config.senderEmail, name: config.senderName },
          to: [{ email: mail.to }],
          subject: mail.subject,
          htmlContent: mail.html,
          textContent: mail.text,
          replyTo: mail.replyTo ? { email: mail.replyTo } : undefined,
          tags: [mail.kind],
        }),
      });
      if (!response.ok) {
        throw new Error(`Brevo send failed with HTTP ${response.status}`);
      }
      const body = (await response.json()) as { messageId?: string };
      return { messageId: body.messageId ?? "" };
    },
  };
}
