import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import {
  courses,
  customerProfiles,
  entitlementEvents,
  entitlements,
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
