import { asc, eq } from "drizzle-orm";

import { writeAudit } from "@/server/audit/log";
import type { PaymentProviderId } from "@/server/adapters/payment";
import { courses, productProviderMappings, products } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import type { StaffActor } from "./access";

export async function listProductsWithMappings(db: DbExecutor) {
  const rows = await db
    .select({ product: products, courseTitle: courses.title })
    .from(products)
    .leftJoin(courses, eq(courses.id, products.courseId))
    .orderBy(asc(products.sortOrder), asc(products.title));
  const mappings = await db.select().from(productProviderMappings);
  return rows.map((r) => ({
    ...r,
    mappings: mappings.filter((m) => m.productId === r.product.id),
  }));
}

export async function addProductMapping(
  db: DbExecutor,
  actor: StaffActor,
  input: { productId: string; provider: PaymentProviderId; providerProductId: string },
): Promise<"added" | "taken"> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(productProviderMappings)
      .values(input)
      .onConflictDoNothing({
        target: [productProviderMappings.provider, productProviderMappings.providerProductId],
      })
      .returning({ id: productProviderMappings.id });
    if (!inserted[0]) return "taken";
    await writeAudit(tx, {
      action: "product.mapping_changed",
      actorUserId: actor.id,
      actorRole: actor.role,
      targetType: "product",
      targetId: input.productId,
      metadata: { added: { provider: input.provider, providerProductId: input.providerProductId } },
    });
    return "added";
  });
}

export async function removeProductMapping(
  db: DbExecutor,
  actor: StaffActor,
  mappingId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(productProviderMappings)
      .where(eq(productProviderMappings.id, mappingId))
      .returning();
    if (!removed) return;
    await writeAudit(tx, {
      action: "product.mapping_changed",
      actorUserId: actor.id,
      actorRole: actor.role,
      targetType: "product",
      targetId: removed.productId,
      metadata: {
        removed: { provider: removed.provider, providerProductId: removed.providerProductId },
      },
    });
  });
}
