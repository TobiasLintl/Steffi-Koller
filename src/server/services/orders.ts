import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";

import { orders, products, users } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";

export interface OrderFilter {
  status?: "paid" | "refunded" | "chargeback" | "cancelled";
  provider?: string;
  currency?: "EUR" | "CHF";
  from?: Date;
  to?: Date;
  userId?: string;
}

export async function listOrders(db: DbExecutor, filter: OrderFilter = {}, limit = 200) {
  const conditions: SQL[] = [];
  if (filter.status) conditions.push(eq(orders.status, filter.status));
  if (filter.provider) conditions.push(eq(orders.provider, filter.provider));
  if (filter.currency) conditions.push(eq(orders.currency, filter.currency));
  if (filter.from) conditions.push(gte(orders.purchasedAt, filter.from));
  if (filter.to) conditions.push(lte(orders.purchasedAt, filter.to));
  if (filter.userId) conditions.push(eq(orders.userId, filter.userId));
  return db
    .select({
      order: orders,
      productTitle: products.title,
      customerName: users.name,
    })
    .from(orders)
    .leftJoin(products, eq(products.id, orders.productId))
    .leftJoin(users, eq(users.id, orders.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.purchasedAt))
    .limit(limit);
}
