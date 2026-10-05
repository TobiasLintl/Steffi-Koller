/**
 * Transactional mail adapter (Brevo default – DECISION D-05).
 * Strictly separate from newsletter delivery (CLAUDE.md §5.5).
 */

export type TransactionalMailKind =
  | "access_granted"
  | "magic_link"
  | "password_reset"
  | "email_verification"
  | "staff_invite"
  | "admin_notification"
  | "newsletter_confirmation"
  | "module_unlocked"
  | "expiry_reminder"
  | "support";

export interface TransactionalMail {
  kind: TransactionalMailKind;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface MailAdapter {
  send(mail: TransactionalMail): Promise<{ messageId: string }>;
}
