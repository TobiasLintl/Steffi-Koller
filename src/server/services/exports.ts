import { asc, eq } from "drizzle-orm";

import type { Permission } from "@/server/auth/permissions";
import {
  consentRecords,
  courses,
  customerProfiles,
  entitlements,
  lessons,
  modules,
  newsletterSubscriptions,
  orders,
  products,
  users,
} from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import { entitlementState } from "@/server/domain/access";

/** ARC-03 / AK-13: everything that belongs to the business is exportable as CSV and JSON. */
export const EXPORT_DATASETS = {
  customers: { label: "Kunden", permission: "exports:all" },
  orders: { label: "Käufe", permission: "exports:orders" },
  entitlements: { label: "Berechtigungen", permission: "exports:all" },
  consents: { label: "Einwilligungen", permission: "exports:all" },
  courses: { label: "Kurse (Struktur und Texte)", permission: "exports:all" },
} as const satisfies Record<string, { label: string; permission: Permission }>;

export type ExportDataset = keyof typeof EXPORT_DATASETS;

export function isExportDataset(value: string): value is ExportDataset {
  return value in EXPORT_DATASETS;
}

export async function exportDataset(
  db: DbExecutor,
  dataset: ExportDataset,
  now = new Date(),
): Promise<Record<string, unknown>[]> {
  switch (dataset) {
    case "customers":
      return (
        await db
          .select({ user: users, profile: customerProfiles })
          .from(users)
          .leftJoin(customerProfiles, eq(customerProfiles.userId, users.id))
          .where(eq(users.role, "customer"))
          .orderBy(asc(users.createdAt))
      ).map(({ user, profile }) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        anonymizedAt: user.anonymizedAt,
        customerType: profile?.customerType,
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        companyName: profile?.companyName,
        vatId: profile?.vatId,
        street: profile?.street,
        postalCode: profile?.postalCode,
        city: profile?.city,
        country: profile?.country,
      }));
    case "orders":
      return (
        await db
          .select({ order: orders, productTitle: products.title, email: users.email })
          .from(orders)
          .leftJoin(products, eq(products.id, orders.productId))
          .leftJoin(users, eq(users.id, orders.userId))
          .orderBy(asc(orders.purchasedAt))
      ).map(({ order, productTitle, email }) => ({
        id: order.id,
        purchasedAt: order.purchasedAt,
        provider: order.provider,
        transactionId: order.transactionId,
        providerOrderId: order.providerOrderId,
        receiptReference: order.receiptReference,
        product: productTitle,
        providerProductId: order.providerProductId,
        status: order.status,
        amount: order.amountMinor === null ? null : (order.amountMinor / 100).toFixed(2),
        currency: order.currency,
        buyerCountry: order.buyerCountry,
        customerType: order.customerType,
        companyName: order.companyName,
        vatId: order.vatId,
        billingStreet: order.billingStreet,
        billingPostalCode: order.billingPostalCode,
        billingCity: order.billingCity,
        billingCountry: order.billingCountry,
        paymentMethod: order.paymentMethod,
        isTest: order.isTest,
        refundedAt: order.refundedAt,
        retentionUntil: order.retentionUntil,
        customerId: order.userId,
        customerEmail: email,
      }));
    case "entitlements":
      return (
        await db
          .select({ ent: entitlements, course: courses.title, email: users.email })
          .from(entitlements)
          .innerJoin(courses, eq(courses.id, entitlements.courseId))
          .innerJoin(users, eq(users.id, entitlements.userId))
          .orderBy(asc(entitlements.createdAt))
      ).map(({ ent, course, email }) => ({
        id: ent.id,
        customerId: ent.userId,
        customerEmail: email,
        course,
        courseId: ent.courseId,
        status: ent.status,
        state: entitlementState(ent, now),
        source: ent.source,
        startsAt: ent.startsAt,
        expiresAt: ent.expiresAt,
        createdAt: ent.createdAt,
      }));
    case "consents": {
      const newsletter = (
        await db
          .select()
          .from(newsletterSubscriptions)
          .orderBy(asc(newsletterSubscriptions.subscribedAt))
      ).map((n) => ({
        type: "newsletter",
        subject: n.email,
        status: n.status,
        version: n.consentTextVersion,
        source: n.source,
        givenAt: n.subscribedAt,
        givenIp: n.subscribeIpTruncated,
        confirmedAt: n.confirmedAt,
        confirmedIp: n.confirmIpTruncated,
        withdrawnAt: n.unsubscribedAt,
        statistics: null,
        marketing: null,
      }));
      const cookies = (
        await db.select().from(consentRecords).orderBy(asc(consentRecords.createdAt))
      ).map((c) => ({
        type: "cookies",
        subject: c.consentId,
        status: "recorded",
        version: c.policyVersion,
        source: "banner",
        givenAt: c.createdAt,
        givenIp: c.ipTruncated,
        confirmedAt: null,
        confirmedIp: null,
        withdrawnAt: null,
        statistics: c.statistics,
        marketing: c.marketing,
      }));
      return [...newsletter, ...cookies];
    }
    case "courses":
      return (
        await db
          .select({ course: courses, module: modules, lesson: lessons })
          .from(courses)
          .leftJoin(modules, eq(modules.courseId, courses.id))
          .leftJoin(lessons, eq(lessons.moduleId, modules.id))
          .orderBy(asc(courses.title), asc(modules.position), asc(lessons.position))
      ).map(({ course, module, lesson }) => ({
        courseId: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        moduleId: module?.id,
        moduleTitle: module?.title,
        modulePosition: module?.position,
        unlockAfterDays: module?.unlockAfterDays,
        lessonId: lesson?.id,
        lessonTitle: lesson?.title,
        lessonPosition: lesson?.position,
        lessonBody: lesson?.body,
        lessonTranscript: lesson?.transcript,
      }));
  }
}
