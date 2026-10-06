import { createHash, randomBytes } from "node:crypto";

/** Version of the consent text shown next to every newsletter form. Bump on every change. */
export const NEWSLETTER_CONSENT_VERSION = "2026-10-01";

export const NEWSLETTER_CONSENT_TEXT =
  "Ja, ich möchte den Seelenzeit-Newsletter mit Impulsen und Informationen zu Angeboten per E-Mail erhalten. " +
  "Meine Einwilligung kann ich jederzeit über den Abmeldelink in jeder E-Mail widerrufen. " +
  "Details stehen in der Datenschutzerklärung.";

export const DOI_TOKEN_TTL_HOURS = 72;

export type NewsletterStatus = "pending" | "confirmed" | "unsubscribed";

/**
 * AK-10: only contacts with a confirmed double opt-in may ever receive newsletters
 * or be synced to the newsletter provider.
 */
export function canReceiveNewsletter(sub: {
  status: NewsletterStatus;
  confirmedAt: Date | null;
}): boolean {
  return sub.status === "confirmed" && sub.confirmedAt !== null;
}

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
