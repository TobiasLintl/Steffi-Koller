import { asc, eq } from "drizzle-orm";

import { writeAudit } from "@/server/audit/log";
import type { PaymentProviderId } from "@/server/adapters/payment";
import { courses, orders, productProviderMappings, products } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import type { ProductInput } from "@/server/domain/catalog/schemas";
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

export class CatalogError extends Error {}

function productValues(input: ProductInput) {
  return {
    slug: input.slug,
    title: input.title,
    subtitle: input.subtitle,
    description: input.description,
    tier: input.tier,
    kind: input.kind,
    courseId: input.courseId,
    accessMonths: input.kind === "course_access" ? input.accessMonths : null,
    extensionMonths: input.kind === "extension" ? input.extensionMonths : null,
    priceEurCents: input.priceEur,
    priceChfCents: input.priceChf,
    checkoutUrl: input.checkoutUrl,
    isPublished: input.isPublished,
    sortOrder: input.sortOrder,
  };
}

export async function getProduct(db: DbExecutor, id: string) {
  const [row] = await db.select().from(products).where(eq(products.id, id));
  return row;
}

export async function createProduct(
  db: DbExecutor,
  actor: StaffActor,
  input: ProductInput,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [taken] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, input.slug));
    if (taken) throw new CatalogError("Diese Adresse (Slug) ist schon vergeben.");
    const [row] = await tx
      .insert(products)
      .values(productValues(input))
      .returning({ id: products.id });
    await writeAudit(tx, {
      action: "product.created",
      actorUserId: actor.id,
      actorRole: actor.role,
      targetType: "product",
      targetId: row!.id,
      metadata: { slug: input.slug },
    });
    return row!.id;
  });
}

export async function updateProduct(
  db: DbExecutor,
  actor: StaffActor,
  id: string,
  input: ProductInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [taken] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, input.slug));
    if (taken && taken.id !== id)
      throw new CatalogError("Diese Adresse (Slug) ist schon vergeben.");
    const [before] = await tx.select().from(products).where(eq(products.id, id));
    if (!before) throw new CatalogError("Produkt nicht gefunden.");
    const values = productValues(input);
    await tx
      .update(products)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(products.id, id));
    const changed = Object.fromEntries(
      Object.entries(values).filter(
        ([k, v]) => String((before as Record<string, unknown>)[k]) !== String(v),
      ),
    );
    await writeAudit(tx, {
      action: "product.updated",
      actorUserId: actor.id,
      actorRole: actor.role,
      targetType: "product",
      targetId: id,
      metadata: { changed },
    });
  });
}

export async function deleteProduct(db: DbExecutor, actor: StaffActor, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.productId, id))
      .limit(1);
    if (order)
      throw new CatalogError(
        "Zu diesem Produkt gibt es Käufe. Bitte stattdessen „nicht veröffentlicht“ setzen.",
      );
    const [removed] = await tx
      .delete(products)
      .where(eq(products.id, id))
      .returning({ slug: products.slug });
    if (removed)
      await writeAudit(tx, {
        action: "product.deleted",
        actorUserId: actor.id,
        actorRole: actor.role,
        targetType: "product",
        targetId: id,
        metadata: { slug: removed.slug },
      });
  });
}
