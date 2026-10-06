import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const customerTypeEnum = pgEnum("customer_type", ["b2c", "b2b"]);

/** Customer master data (identity area, ARC-04). B2B fields only when customerType = b2b. */
export const customerProfiles = pgTable("customer_profiles", {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  customerType: customerTypeEnum().notNull().default("b2c"),
  firstName: text(),
  lastName: text(),
  /** ISO 3166-1 alpha-2, e.g. DE, CH, AT. */
  country: text(),
  companyName: text(),
  vatId: text(),
  street: text(),
  postalCode: text(),
  city: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
