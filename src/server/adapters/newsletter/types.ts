/**
 * Newsletter adapter (Brevo or CleverReach – DECISION D-05).
 * Contacts may only be synced after confirmed double opt-in (AK-10).
 */

export interface NewsletterContact {
  email: string;
  firstName?: string;
  /** Proof of consent, required for every synced contact. */
  consent: {
    subscribedAt: Date;
    confirmedAt: Date;
    consentTextVersion: string;
  };
}

export interface NewsletterAdapter {
  upsertConfirmedContact(contact: NewsletterContact): Promise<void>;
  unsubscribe(email: string): Promise<void>;
}
