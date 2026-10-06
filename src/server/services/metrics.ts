import { and, eq, gte, isNotNull, sql } from "drizzle-orm";

/** Qualified reference for correlated subqueries (single-table selects are unqualified). */
const COURSE_ID = sql.raw('"courses"."id"');

import {
  entitlements,
  lessonProgress,
  lessons,
  modules,
  courses,
  newsletterSubscriptions,
  orders,
  products,
  users,
} from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";

export interface DashboardMetrics {
  since: Date | null;
  registrations: number;
  newsletterConfirmed: number;
  freeClaims: number;
  purchases: number;
  revenue: { currency: "EUR" | "CHF"; amountMinor: number }[];
  revenueByProduct: {
    productId: string | null;
    title: string;
    currency: string;
    count: number;
    amountMinor: number;
  }[];
  refunds: number;
  refundedMinor: { currency: string; amountMinor: number }[];
  extensions: number;
  courseStarts: number;
  progressByCourse: {
    courseId: string;
    title: string;
    learners: number;
    started: number;
    avgCompletion: number;
  }[];
}

/**
 * Own KPIs without ad tracking (Pflichtenheft §14): leads → purchases, revenue per product,
 * refunds, course starts, progress and extension purchases. Test orders are excluded.
 */
export async function dashboardMetrics(
  db: DbExecutor,
  since: Date | null,
): Promise<DashboardMetrics> {
  const orderSince = since ? gte(orders.purchasedAt, since) : undefined;
  const realOrder = eq(orders.isTest, false);

  const [registrations] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "customer"), since ? gte(users.createdAt, since) : undefined));
  const [newsletterConfirmed] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(newsletterSubscriptions)
    .where(
      and(
        eq(newsletterSubscriptions.status, "confirmed"),
        since ? gte(newsletterSubscriptions.confirmedAt, since) : undefined,
      ),
    );
  const [freeClaims] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(entitlements)
    .where(
      and(eq(entitlements.source, "free"), since ? gte(entitlements.createdAt, since) : undefined),
    );

  const byProduct = await db
    .select({
      productId: orders.productId,
      title: sql<string>`coalesce(${products.title}, ${orders.providerProductId})`,
      kind: products.kind,
      currency: sql<string>`coalesce(${orders.currency}::text, 'EUR')`,
      count: sql<number>`count(*)::int`,
      amountMinor: sql<number>`coalesce(sum(${orders.amountMinor}), 0)::int`,
    })
    .from(orders)
    .leftJoin(products, eq(products.id, orders.productId))
    .where(and(realOrder, eq(orders.status, "paid"), orderSince))
    .groupBy(
      orders.productId,
      products.title,
      products.kind,
      orders.providerProductId,
      orders.currency,
    );

  const refundsRows = await db
    .select({
      currency: sql<string>`coalesce(${orders.currency}::text, 'EUR')`,
      count: sql<number>`count(*)::int`,
      amountMinor: sql<number>`coalesce(sum(${orders.amountMinor}), 0)::int`,
    })
    .from(orders)
    .where(
      and(
        realOrder,
        sql`${orders.status} in ('refunded', 'chargeback')`,
        since ? gte(orders.refundedAt, since) : undefined,
      ),
    )
    .groupBy(orders.currency);

  const [courseStarts] = await db
    .select({
      n: sql<number>`count(distinct (${lessonProgress.userId}, ${modules.courseId}))::int`,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(since ? gte(lessonProgress.lastViewedAt, since) : undefined);

  const progressByCourse = await db
    .select({
      courseId: courses.id,
      title: courses.title,
      learners: sql<number>`(select count(*)::int from ${entitlements} e where e.course_id = ${COURSE_ID})`,
      started: sql<number>`(select count(distinct lp.user_id)::int from ${lessonProgress} lp join ${lessons} l on l.id = lp.lesson_id join ${modules} m on m.id = l.module_id where m.course_id = ${COURSE_ID})`,
      avgCompletion: sql<number>`coalesce((
        select avg(done::float / nullif(total, 0)) from (
          select e.user_id,
            (select count(*) from ${lessonProgress} lp join ${lessons} l on l.id = lp.lesson_id join ${modules} m on m.id = l.module_id
              where m.course_id = ${COURSE_ID} and lp.user_id = e.user_id and lp.completed_at is not null) as done,
            (select count(*) from ${lessons} l join ${modules} m on m.id = l.module_id where m.course_id = ${COURSE_ID}) as total
          from ${entitlements} e where e.course_id = ${COURSE_ID}
        ) x
      ), 0)`,
    })
    .from(courses)
    .where(isNotNull(courses.id));

  const revenueMap = new Map<string, number>();
  for (const r of byProduct)
    revenueMap.set(r.currency, (revenueMap.get(r.currency) ?? 0) + r.amountMinor);

  return {
    since,
    registrations: registrations?.n ?? 0,
    newsletterConfirmed: newsletterConfirmed?.n ?? 0,
    freeClaims: freeClaims?.n ?? 0,
    purchases: byProduct.reduce((s, r) => s + r.count, 0),
    revenue: [...revenueMap.entries()].map(([currency, amountMinor]) => ({
      currency: currency as "EUR" | "CHF",
      amountMinor,
    })),
    revenueByProduct: byProduct
      .map((r) => ({
        productId: r.productId,
        title: r.title,
        currency: r.currency,
        count: r.count,
        amountMinor: r.amountMinor,
      }))
      .sort((a, b) => b.amountMinor - a.amountMinor),
    refunds: refundsRows.reduce((s, r) => s + r.count, 0),
    refundedMinor: refundsRows.map((r) => ({ currency: r.currency, amountMinor: r.amountMinor })),
    extensions: byProduct.filter((r) => r.kind === "extension").reduce((s, r) => s + r.count, 0),
    courseStarts: courseStarts?.n ?? 0,
    progressByCourse: progressByCourse.map((p) => ({
      ...p,
      avgCompletion: Number(p.avgCompletion),
    })),
  };
}

export function periodStart(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
