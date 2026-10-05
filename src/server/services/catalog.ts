import { and, asc, eq, inArray, ne } from "drizzle-orm";

import { courses, entitlements, products } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import { grantAccess } from "./access";

/** Published products shown on the website (extensions are only offered in the account). */
export async function listPublicOffers(db: DbExecutor) {
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.isPublished, true),
        inArray(products.kind, ["course_access", "coaching"]),
        ne(products.tier, "free"),
      ),
    )
    .orderBy(asc(products.sortOrder), asc(products.title));
}

export async function listFreeProducts(db: DbExecutor) {
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.isPublished, true),
        eq(products.tier, "free"),
        eq(products.kind, "course_access"),
      ),
    )
    .orderBy(asc(products.sortOrder));
}

export async function getPublicProduct(db: DbExecutor, slug: string) {
  const [row] = await db
    .select({
      product: products,
      course: { id: courses.id, slug: courses.slug, title: courses.title },
    })
    .from(products)
    .leftJoin(courses, eq(courses.id, products.courseId))
    .where(
      and(eq(products.slug, slug), eq(products.isPublished, true), ne(products.kind, "extension")),
    );
  return row;
}

export type ClaimResult =
  { status: "granted" | "already"; courseSlug: string } | { status: "not_found" };

/** Free products (lead magnets): grant once, never extend on repeated clicks. */
export async function claimFreeProduct(
  db: DbExecutor,
  userId: string,
  productId: string,
): Promise<ClaimResult> {
  const [row] = await db
    .select({ product: products, course: courses })
    .from(products)
    .innerJoin(courses, eq(courses.id, products.courseId))
    .where(
      and(
        eq(products.id, productId),
        eq(products.tier, "free"),
        eq(products.isPublished, true),
        eq(products.kind, "course_access"),
      ),
    );
  if (!row) return { status: "not_found" };
  const [existing] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(and(eq(entitlements.userId, userId), eq(entitlements.courseId, row.course.id)));
  if (existing) return { status: "already", courseSlug: row.course.slug };
  await grantAccess(db, {
    userId,
    courseId: row.course.id,
    accessMonths: row.product.accessMonths,
    source: "free",
    reason: "Kostenloses Angebot",
  });
  return { status: "granted", courseSlug: row.course.slug };
}
