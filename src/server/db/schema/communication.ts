import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const emailStatusEnum = pgEnum("email_status", ["pending", "sent", "failed"]);

/**
 * Transactional mail log. Stores the user id, never the address (CLAUDE.md §6).
 * `dedupeKey` makes scheduled mails (drip, reminders) idempotent.
 */
export const emailLog = pgTable(
  "email_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: text().notNull(),
    userId: text().references(() => users.id, { onDelete: "set null" }),
    dedupeKey: text(),
    status: emailStatusEnum().notNull().default("pending"),
    providerMessageId: text(),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("email_log_dedupe_idx").on(t.dedupeKey),
    index("email_log_user_idx").on(t.userId, t.createdAt),
  ],
);

export const newsletterStatusEnum = pgEnum("newsletter_status", [
  "pending",
  "confirmed",
  "unsubscribed",
]);

/** Newsletter consent with double-opt-in proof (CLAUDE.md §5.5). */
export const newsletterSubscriptions = pgTable(
  "newsletter_subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    userId: text().references(() => users.id, { onDelete: "set null" }),
    status: newsletterStatusEnum().notNull().default("pending"),
    source: text().notNull().default("website"),
    consentTextVersion: text().notNull(),
    /** sha256 of the confirmation token (the token itself is only in the e-mail). */
    confirmTokenHash: text(),
    confirmTokenExpiresAt: timestamp({ withTimezone: true }),
    /** sha256 of the unsubscribe token. */
    unsubscribeTokenHash: text().notNull(),
    subscribedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    subscribeIpTruncated: text(),
    confirmedAt: timestamp({ withTimezone: true }),
    confirmIpTruncated: text(),
    unsubscribedAt: timestamp({ withTimezone: true }),
    syncedAt: timestamp({ withTimezone: true }),
    syncError: text(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("newsletter_email_idx").on(t.email),
    index("newsletter_status_idx").on(t.status),
    index("newsletter_confirm_token_idx").on(t.confirmTokenHash),
    index("newsletter_unsubscribe_token_idx").on(t.unsubscribeTokenHash),
  ],
);
