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
import { products } from "./catalog";
import { customerTypeEnum } from "./customers";

export const currencyEnum = pgEnum("currency", ["EUR", "CHF"]);
export const orderStatusEnum = pgEnum("order_status", [
  "paid",
  "refunded",
  "chargeback",
  "cancelled",
]);
export const webhookStatusEnum = pgEnum("webhook_status", [
  "received",
  "processed",
  "ignored",
  "failed",
]);

/** Raw reseller notifications, stored before processing (CLAUDE.md §5.3). */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    provider: text().notNull(),
    /** Idempotency key: provider + transaction id + event type. */
    eventKey: text().notNull(),
    providerEventType: text().notNull(),
    transactionId: text(),
    rawBody: text().notNull(),
    status: webhookStatusEnum().notNull().default("received"),
    error: text(),
    attempts: integer().notNull().default(0),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("webhook_events_event_key_idx").on(t.eventKey),
    index("webhook_events_status_idx").on(t.status, t.receivedAt),
  ],
);

/** One row per reseller transaction (purchase). Refunds/chargebacks update its status. */
export const orders = pgTable(
  "orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    provider: text().notNull(),
    transactionId: text().notNull(),
    providerOrderId: text().notNull(),
    providerProductId: text().notNull(),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
    userId: text().references(() => users.id, { onDelete: "set null" }),
    status: orderStatusEnum().notNull().default("paid"),
    amountMinor: integer(),
    currency: currencyEnum(),
    buyerCountry: text(),
    customerType: customerTypeEnum().notNull().default("b2c"),
    companyName: text(),
    vatId: text(),
    billingStreet: text(),
    billingPostalCode: text(),
    billingCity: text(),
    billingCountry: text(),
    receiptReference: text(),
    paymentMethod: text(),
    isTest: boolean().notNull().default(false),
    purchasedAt: timestamp({ withTimezone: true }).notNull(),
    refundedAt: timestamp({ withTimezone: true }),
    /** Statutory retention for purchase records (CLAUDE.md §6), default 10 years. */
    retentionUntil: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_provider_tx_idx").on(t.provider, t.transactionId),
    index("orders_provider_order_idx").on(t.provider, t.providerOrderId, t.providerProductId),
    index("orders_user_idx").on(t.userId),
    index("orders_purchased_idx").on(t.purchasedAt),
  ],
);

/** Reseller product id ↔ internal product, maintained in the admin. */
export const productProviderMappings = pgTable(
  "product_provider_mappings",
  {
    id: uuid().primaryKey().defaultRandom(),
    provider: text().notNull(),
    providerProductId: text().notNull(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("product_provider_mappings_idx").on(t.provider, t.providerProductId)],
);

/** Small key/value store for admin-configurable policies (e.g. DECISION D-01). */
export const appSettings = pgTable("app_settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedBy: text(),
});

export const adminNotifications = pgTable(
  "admin_notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    link: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("admin_notifications_created_idx").on(t.createdAt)],
);
