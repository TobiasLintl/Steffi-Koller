import type { MailAdapter } from "./types";

/** Development driver: prints mails to the server log, recipient masked (CLAUDE.md §6). */
export function createLogMailAdapter(): MailAdapter {
  let counter = 0;
  return {
    async send(mail) {
      counter += 1;
      const messageId = `log-${Date.now()}-${counter}`;
      console.info(
        `[mail:${mail.kind}] to=${maskEmail(mail.to)} subject="${mail.subject}"\n${mail.text}\n`,
      );
      return { messageId };
    },
  };
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}
