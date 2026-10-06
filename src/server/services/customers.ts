import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import {
  contactMessages,
  courses,
  customerProfiles,
  entitlementEvents,
  entitlements,
  lessonProgress,
  lessons,
  modules,
  newsletterSubscriptions,
  orders,
  products,
  supportNotes,
  users,
} from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import { entitlementState } from "@/server/domain/access";

export async function searchCustomers(db: DbExecutor, query: string, limit = 50) {
  const q = query.trim();
  const pattern = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      country: customerProfiles.country,
      customerType: customerProfiles.customerType,
      companyName: customerProfiles.companyName,
      courseCount: sql<number>`(select count(*)::int from ${entitlements} where ${entitlements.userId} = ${users.id})`,
    })
    .from(users)
    .leftJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .where(
      and(
        eq(users.role, "customer"),
        isNull(users.anonymizedAt),
        q
          ? or(
              ilike(users.email, pattern),
              ilike(users.name, pattern),
              ilike(customerProfiles.lastName, pattern),
              ilike(customerProfiles.companyName, pattern),
            )
          : undefined,
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(limit);
}

export async function getCustomerFile(db: DbExecutor, userId: string, now = new Date()) {
  const [row] = await db
    .select({ user: users, profile: customerProfiles })
    .from(users)
    .leftJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .where(eq(users.id, userId));
  if (!row) return null;

  const ents = await db
    .select({
      entitlement: entitlements,
      course: { id: courses.id, title: courses.title, slug: courses.slug },
    })
    .from(entitlements)
    .innerJoin(courses, eq(courses.id, entitlements.courseId))
    .where(eq(entitlements.userId, userId))
    .orderBy(asc(courses.title));

  const events = ents.length
    ? await db
        .select()
        .from(entitlementEvents)
        .innerJoin(entitlements, eq(entitlements.id, entitlementEvents.entitlementId))
        .where(eq(entitlements.userId, userId))
        .orderBy(desc(entitlementEvents.createdAt))
    : [];

  return {
    user: row.user,
    profile: row.profile,
    entitlements: ents.map(({ entitlement, course }) => ({
      ...entitlement,
      course,
      state: entitlementState(entitlement, now),
      events: events
        .filter((e) => e.entitlement_events.entitlementId === entitlement.id)
        .map((e) => e.entitlement_events),
    })),
  };
}

export async function listCoursesForSelect(db: DbExecutor) {
  return db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .orderBy(asc(courses.title));
}

export interface BuyerData {
  email: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  customerType: "b2c" | "b2b";
  billing: {
    companyName?: string;
    vatId?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };
}

/**
 * Finds the account by e-mail or creates one (CLAUDE.md §5.3). New accounts have no password;
 * the buyer signs in with a magic link, which also verifies the address.
 */
export async function findOrCreateCustomer(
  db: DbExecutor,
  buyer: BuyerData,
): Promise<{ id: string; email: string; name: string; created: boolean }> {
  const email = buyer.email.trim().toLowerCase();
  const name =
    [buyer.firstName, buyer.lastName].filter(Boolean).join(" ") ||
    email.split("@")[0] ||
    "Kundin/Kunde";
  const id = randomUUID();
  const inserted = await db
    .insert(users)
    .values({ id, email, name, role: "customer", emailVerified: false })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email, name: users.name });
  const user =
    inserted[0] ??
    (
      await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.email, email))
    )[0];
  if (!user) throw new Error("Customer could not be created");

  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, user.id));
  const b2b = buyer.customerType === "b2b";
  const patch = {
    firstName: profile?.firstName ?? buyer.firstName ?? null,
    lastName: profile?.lastName ?? buyer.lastName ?? null,
    country: buyer.country ?? profile?.country ?? null,
    // The latest B2B purchase carries the current billing data.
    ...(b2b
      ? {
          customerType: "b2b" as const,
          companyName: buyer.billing.companyName ?? null,
          vatId: buyer.billing.vatId ?? null,
          street: buyer.billing.street ?? null,
          postalCode: buyer.billing.postalCode ?? null,
          city: buyer.billing.city ?? null,
        }
      : {}),
    updatedAt: new Date(),
  };
  await db
    .insert(customerProfiles)
    .values({ userId: user.id, ...patch })
    .onConflictDoUpdate({ target: customerProfiles.userId, set: patch });

  return { ...user, created: Boolean(inserted[0]) };
}

/** Additional sections of the customer file; each is only loaded when the viewer may see it. */
export async function getCustomerFileExtras(
  db: DbExecutor,
  userId: string,
  email: string,
  include: { orders: boolean; newsletter: boolean; support: boolean },
) {
  const progress = await db
    .select({
      courseId: modules.courseId,
      completed: sql<number>`count(${lessonProgress.completedAt})::int`,
      lastViewedAt: sql<Date | null>`max(${lessonProgress.lastViewedAt})`,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(eq(lessonProgress.userId, userId))
    .groupBy(modules.courseId);
  const totals = await db
    .select({ courseId: modules.courseId, total: sql<number>`count(${lessons.id})::int` })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .groupBy(modules.courseId);

  return {
    progress: progress.map((p) => ({
      ...p,
      total: totals.find((t) => t.courseId === p.courseId)?.total ?? 0,
    })),
    orders: include.orders
      ? await db
          .select({ order: orders, productTitle: products.title })
          .from(orders)
          .leftJoin(products, eq(products.id, orders.productId))
          .where(eq(orders.userId, userId))
          .orderBy(desc(orders.purchasedAt))
      : null,
    newsletter: include.newsletter
      ? ((
          await db
            .select()
            .from(newsletterSubscriptions)
            .where(eq(newsletterSubscriptions.email, email.toLowerCase()))
        )[0] ?? null)
      : undefined,
    notes: include.support
      ? await db
          .select()
          .from(supportNotes)
          .where(eq(supportNotes.userId, userId))
          .orderBy(desc(supportNotes.createdAt))
      : null,
    messages: include.support
      ? await db
          .select()
          .from(contactMessages)
          .where(eq(contactMessages.userId, userId))
          .orderBy(desc(contactMessages.createdAt))
      : null,
  };
}

export async function addSupportNote(
  db: DbExecutor,
  input: { userId: string; authorId: string; authorName: string; note: string },
) {
  await db.insert(supportNotes).values(input);
}
