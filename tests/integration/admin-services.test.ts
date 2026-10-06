import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { auditLog, modules, orders, sessions, users } from "@/server/db/schema";
import { productInputSchema } from "@/server/domain/catalog/schemas";
import { grantAccess } from "@/server/services/access";
import {
  addModule,
  deleteCourse,
  getCourseTree,
  reorderModules,
} from "@/server/services/course-editor";
import { activePromotionsFor, saveCoupon } from "@/server/services/coupons";
import { dashboardMetrics } from "@/server/services/metrics";
import {
  CatalogError,
  createProduct,
  deleteProduct,
  updateProduct,
} from "@/server/services/products";
import { changeRole, inviteStaff, StaffError } from "@/server/services/staff";
import { closeTestDb, createUser, resetTables, testDb } from "../support/db";
import { createCourse, createProduct as fixtureProduct } from "../support/fixtures";

const db = testDb();
beforeEach(() => resetTables(db));
afterAll(closeTestDb);

async function actor(role: "admin" | "editor" | "support" = "admin") {
  const u = await createUser(db, { role });
  return { id: u.id, role };
}

describe("products", () => {
  it("creates and updates products with audit entries, refuses duplicate slugs", async () => {
    const admin = await actor();
    const { course } = await createCourse(db);
    const input = productInputSchema.parse({
      slug: "neu",
      title: "Neu",
      tier: "small",
      kind: "course_access",
      courseId: course.id,
      accessMonths: "6",
      priceEur: "49",
      priceChf: "",
      checkoutUrl: "https://x.test/c",
      isPublished: true,
      sortOrder: "",
    });
    const id = await createProduct(db, admin, input);
    await updateProduct(db, admin, id, { ...input, accessMonths: 9 });
    await expect(createProduct(db, admin, input)).rejects.toBeInstanceOf(CatalogError);
    const entries = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, id))
      .orderBy(asc(auditLog.id));
    expect(entries.map((e) => e.action)).toEqual(["product.created", "product.updated"]);
    expect(entries[1]!.metadata).toMatchObject({ changed: { accessMonths: 9 } });
  });

  it("refuses to delete products that have orders", async () => {
    const admin = await actor();
    const { course } = await createCourse(db);
    const product = await fixtureProduct(db, {
      courseId: course.id,
      tier: "small",
      accessMonths: 6,
    });
    await db.insert(orders).values({
      provider: "copecart",
      transactionId: "t1",
      providerOrderId: "o1",
      providerProductId: "p1",
      productId: product.id,
      purchasedAt: new Date(),
      retentionUntil: new Date(),
    });
    await expect(deleteProduct(db, admin, product.id)).rejects.toBeInstanceOf(CatalogError);
  });
});

describe("course editor", () => {
  it("reorders modules and protects courses with learners", async () => {
    const admin = await actor("editor");
    const { course } = await createCourse(db, { modules: [{ lessons: 1 }, { lessons: 1 }] });
    const third = await addModule(db, course.id, {
      title: "Drei",
      description: "",
      unlockAfterDays: 14,
    });
    const tree = await getCourseTree(db, course.id);
    const ids = tree!.modules.map((m) => m.id);
    await reorderModules(db, course.id, [third, ids[0]!, ids[1]!]);
    const ordered = await db
      .select()
      .from(modules)
      .where(eq(modules.courseId, course.id))
      .orderBy(asc(modules.position));
    expect(ordered.map((m) => m.id)).toEqual([third, ids[0], ids[1]]);
    await expect(reorderModules(db, course.id, [third])).rejects.toBeInstanceOf(CatalogError);

    const learner = await createUser(db);
    await grantAccess(db, {
      userId: learner.id,
      courseId: course.id,
      accessMonths: 6,
      source: "manual",
    });
    await expect(deleteCourse(db, admin, course.id)).rejects.toBeInstanceOf(CatalogError);
  });
});

describe("staff management", () => {
  it("invites staff, changes roles with audit and ends sessions", async () => {
    const admin = await actor();
    const { userId } = await inviteStaff(db, admin, {
      email: "Neue@Example.test",
      name: "Neue Person",
      role: "support",
    });
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user).toMatchObject({
      email: "neue@example.test",
      role: "support",
      emailVerified: true,
    });
    await expect(
      inviteStaff(db, admin, { email: "neue@example.test", name: "x", role: "editor" }),
    ).rejects.toBeInstanceOf(StaffError);

    await db.insert(sessions).values({
      id: randomUUID(),
      token: randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + 3600_000),
    });
    await changeRole(db, admin, userId, "customer", "Ausgeschieden");
    expect((await db.select().from(users).where(eq(users.id, userId)))[0]?.role).toBe("customer");
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, userId))
      .orderBy(asc(auditLog.id));
    expect(audit.map((a) => a.action)).toEqual(["staff.invited", "role.changed"]);
    expect(audit[1]).toMatchObject({
      reason: "Ausgeschieden",
      metadata: { from: "support", to: "customer" },
    });
  });

  it("keeps at least one admin and forbids changing the own role", async () => {
    const admin = await actor();
    await expect(changeRole(db, admin, admin.id, "support", "x")).rejects.toBeInstanceOf(
      StaffError,
    );
    const other = await actor();
    await changeRole(db, other, admin.id, "support", "Umbesetzung");
    await expect(changeRole(db, admin, other.id, "support", "x")).rejects.toThrow(
      /mindestens ein Admin/,
    );
  });
});

describe("coupons and metrics", () => {
  it("shows promotions only within their validity and for matching products", async () => {
    const { course } = await createCourse(db);
    const a = await fixtureProduct(db, { courseId: course.id, tier: "small", accessMonths: 6 });
    const b = await fixtureProduct(db, { courseId: course.id, tier: "medium", accessMonths: 6 });
    const base = {
      description: "",
      discountType: "percent" as const,
      discountValue: 10,
      currency: null,
      providerReference: "",
      isActive: true,
      showOnWebsite: true,
      websiteNotice: "Sommeraktion",
    };
    await saveCoupon(db, {
      ...base,
      code: "SOMMER",
      productIds: [a.id],
      validFrom: new Date("2026-06-01T00:00:00Z"),
      validUntil: new Date("2026-07-01T00:00:00Z"),
    });
    await saveCoupon(db, {
      ...base,
      code: "ALLE",
      productIds: [],
      validFrom: null,
      validUntil: null,
    });
    const june = new Date("2026-06-10T00:00:00Z");
    expect((await activePromotionsFor(db, a.id, june)).map((c) => c.code).sort()).toEqual([
      "ALLE",
      "SOMMER",
    ]);
    expect((await activePromotionsFor(db, b.id, june)).map((c) => c.code)).toEqual(["ALLE"]);
    expect(
      (await activePromotionsFor(db, a.id, new Date("2026-08-01T00:00:00Z"))).map((c) => c.code),
    ).toEqual(["ALLE"]);
  });

  it("aggregates revenue per currency without test orders", async () => {
    const { course } = await createCourse(db);
    const product = await fixtureProduct(db, {
      courseId: course.id,
      tier: "small",
      accessMonths: 6,
    });
    const base = {
      provider: "copecart",
      providerOrderId: "o",
      providerProductId: "p",
      productId: product.id,
      purchasedAt: new Date(),
      retentionUntil: new Date(),
    };
    await db.insert(orders).values([
      { ...base, transactionId: "1", amountMinor: 4900, currency: "EUR" as const },
      { ...base, transactionId: "2", amountMinor: 5200, currency: "CHF" as const },
      { ...base, transactionId: "3", amountMinor: 4900, currency: "EUR" as const, isTest: true },
      {
        ...base,
        transactionId: "4",
        amountMinor: 4900,
        currency: "EUR" as const,
        status: "refunded" as const,
        refundedAt: new Date(),
      },
    ]);
    const m = await dashboardMetrics(db, null);
    expect(m.purchases).toBe(2);
    expect(m.revenue.sort((x, y) => x.currency.localeCompare(y.currency))).toEqual([
      { currency: "CHF", amountMinor: 5200 },
      { currency: "EUR", amountMinor: 4900 },
    ]);
    expect(m.refunds).toBe(1);
  });
});
