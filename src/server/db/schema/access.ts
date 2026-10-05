import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { courses, lessons } from "./catalog";
import { orders } from "./orders";

export const entitlementStatusEnum = pgEnum("entitlement_status", ["active", "revoked"]);
export const entitlementSourceEnum = pgEnum("entitlement_source", ["purchase", "manual", "free"]);
export const entitlementEventTypeEnum = pgEnum("entitlement_event_type", [
  "granted",
  "extended",
  "revoked",
  "reinstated",
  "reduced",
]);

/** Exactly one entitlement per user and course (CLAUDE.md §5.1). */
export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    status: entitlementStatusEnum().notNull().default("active"),
    source: entitlementSourceEnum().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    /** null = unlimited. */
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("entitlements_user_course_idx").on(t.userId, t.courseId),
    index("entitlements_expires_idx").on(t.expiresAt),
  ],
);

/** History of every entitlement change. */
export const entitlementEvents = pgTable(
  "entitlement_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    entitlementId: uuid()
      .notNull()
      .references(() => entitlements.id, { onDelete: "cascade" }),
    type: entitlementEventTypeEnum().notNull(),
    previousExpiresAt: timestamp({ withTimezone: true }),
    newExpiresAt: timestamp({ withTimezone: true }),
    /** Staff user for manual changes; null for automatic (webhook) changes. */
    actorUserId: text(),
    orderId: uuid().references(() => orders.id, { onDelete: "set null" }),
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("entitlement_events_entitlement_idx").on(t.entitlementId, t.createdAt)],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid()
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: timestamp({ withTimezone: true }),
    lastViewedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);
