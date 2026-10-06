import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { PRODUCT_TIERS } from "@/server/domain/access/product-defaults";

export const productTierEnum = pgEnum("product_tier", PRODUCT_TIERS);
export const productKindEnum = pgEnum("product_kind", ["course_access", "extension", "coaching"]);

export const courses = pgTable("courses", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  description: text().notNull().default(""),
  isPublished: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const modules = pgTable(
  "modules",
  {
    id: uuid().primaryKey().defaultRandom(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text().notNull().default(""),
    position: integer().notNull().default(0),
    /** Drip: days after entitlement.starts_at (CLAUDE.md §5.2). */
    unlockAfterDays: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("modules_course_idx").on(t.courseId, t.position)],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid().primaryKey().defaultRandom(),
    moduleId: uuid()
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    title: text().notNull(),
    position: integer().notNull().default(0),
    body: text().notNull().default(""),
    /** MED-05: transcript per lesson. */
    transcript: text().notNull().default(""),
    durationMinutes: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lessons_module_idx").on(t.moduleId, t.position)],
);

/** Sellable products. Durations are per product and editable in the admin (CLAUDE.md §5.1). */
export const products = pgTable(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    title: text().notNull(),
    subtitle: text().notNull().default(""),
    description: text().notNull().default(""),
    tier: productTierEnum().notNull(),
    kind: productKindEnum().notNull().default("course_access"),
    courseId: uuid().references(() => courses.id, { onDelete: "restrict" }),
    /** course_access: months of access, null = unlimited. */
    accessMonths: integer(),
    /** extension: months added on purchase. */
    extensionMonths: integer(),
    /** Display prices only – the reseller is the merchant of record. */
    priceEurCents: integer(),
    priceChfCents: integer(),
    /** Reseller checkout link (buy button). */
    checkoutUrl: text(),
    imageUrl: text(),
    isPublished: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("products_slug_idx").on(t.slug), index("products_course_idx").on(t.courseId)],
);
