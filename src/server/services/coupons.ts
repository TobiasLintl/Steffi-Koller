import { and, arrayContains, desc, eq, or, sql } from "drizzle-orm";

import { coupons } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import { isCouponActive, type couponInputSchema } from "@/server/domain/catalog/schemas";
import type { z } from "zod";

type CouponInput = z.output<typeof couponInputSchema>;

export async function listCoupons(db: DbExecutor) {
  return db.select().from(coupons).orderBy(desc(coupons.createdAt));
}

export async function saveCoupon(db: DbExecutor, input: CouponInput, id?: string): Promise<void> {
  const values = {
    ...input,
    providerReference: input.providerReference || null,
    updatedAt: new Date(),
  };
  if (id) await db.update(coupons).set(values).where(eq(coupons.id, id));
  else await db.insert(coupons).values(values);
}

export async function deleteCoupon(db: DbExecutor, id: string): Promise<void> {
  await db.delete(coupons).where(eq(coupons.id, id));
}

/** Promotions to show on a product page right now (redeemed at the reseller checkout). */
export async function activePromotionsFor(db: DbExecutor, productId: string, now = new Date()) {
  const rows = await db
    .select()
    .from(coupons)
    .where(
      and(
        eq(coupons.showOnWebsite, true),
        eq(coupons.isActive, true),
        or(
          sql`cardinality(${coupons.productIds}) = 0`,
          arrayContains(coupons.productIds, [productId]),
        ),
      ),
    );
  return rows.filter((c) => isCouponActive(c, now));
}
