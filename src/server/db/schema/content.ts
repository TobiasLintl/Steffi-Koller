import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const pageKindEnum = pgEnum("page_kind", ["content", "legal"]);

/** Simple CMS: pages made of typed blocks, edited in the admin without code. */
export const sitePages = pgTable(
  "site_pages",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    kind: pageKindEnum().notNull().default("content"),
    title: text().notNull(),
    metaDescription: text().notNull().default(""),
    blocks: jsonb().notNull().default([]),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedBy: text(),
  },
  (t) => [uniqueIndex("site_pages_slug_idx").on(t.slug)],
);

/** Public website images (not course media – these are meant to be public). */
export const siteAssets = pgTable("site_assets", {
  id: uuid().primaryKey().defaultRandom(),
  storageKey: text().notNull(),
  fileName: text().notNull(),
  mimeType: text().notNull(),
  alt: text().notNull().default(""),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const faqItems = pgTable("faq_items", {
  id: uuid().primaryKey().defaultRandom(),
  question: text().notNull(),
  answer: text().notNull(),
  position: integer().notNull().default(0),
  isPublished: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const contactStatusEnum = pgEnum("contact_status", ["open", "done"]);

/** Contact form / customer service messages – part of the support history (Pflichtenheft §10). */
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    email: text().notNull(),
    subject: text().notNull(),
    message: text().notNull(),
    userId: text().references(() => users.id, { onDelete: "set null" }),
    status: contactStatusEnum().notNull().default("open"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    handledAt: timestamp({ withTimezone: true }),
    handledBy: text(),
  },
  (t) => [
    index("contact_messages_status_idx").on(t.status, t.createdAt),
    index("contact_messages_user_idx").on(t.userId),
  ],
);

/** Proof of cookie consent decisions (TDDDG §25). No raw IP: truncated only. */
export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid().primaryKey().defaultRandom(),
    consentId: uuid().notNull(),
    statistics: boolean().notNull(),
    marketing: boolean().notNull(),
    policyVersion: text().notNull(),
    ipTruncated: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("consent_records_consent_idx").on(t.consentId)],
);
