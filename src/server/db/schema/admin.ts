import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { currencyEnum } from "./orders";

export const discountTypeEnum = pgEnum("discount_type", ["percent", "amount"]);

/**
 * Coupons and time-limited promotions. Redemption happens at the reseller checkout – this is
 * the administrative record (code, validity, products) and an optional notice on the website.
 */
export const coupons = pgTable(
  "coupons",
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull(),
    description: text().notNull().default(""),
    discountType: discountTypeEnum().notNull(),
    /** percent: 1–100; amount: minor units. */
    discountValue: integer().notNull(),
    currency: currencyEnum(),
    validFrom: timestamp({ withTimezone: true }),
    validUntil: timestamp({ withTimezone: true }),
    /** Product ids the code applies to; empty = all. */
    productIds: uuid().array().notNull().default([]),
    providerReference: text(),
    showOnWebsite: boolean().notNull().default(false),
    websiteNotice: text().notNull().default(""),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("coupons_code_idx").on(t.code)],
);

/** Internal support notes in the customer file (Pflichtenheft §10: Supporthistorie). */
export const supportNotes = pgTable(
  "support_notes",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorId: text(),
    authorName: text(),
    note: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("support_notes_user_idx").on(t.userId, t.createdAt)],
);
