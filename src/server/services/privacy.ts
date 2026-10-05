import { and, eq, inArray, lt } from "drizzle-orm";

import { writeAudit } from "@/server/audit/log";
import type { NewsletterAdapter } from "@/server/adapters/newsletter";
import {
  accounts,
  contactMessages,
  courses,
  customerProfiles,
  emailLog,
  entitlementEvents,
  entitlements,
  lessonProgress,
  lessons,
  newsletterSubscriptions,
  orders,
  products,
  sessions,
  supportNotes,
  twoFactors,
  users,
  verifications,
  webhookEvents,
} from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import { entitlementState } from "@/server/domain/access";
import { ORDER_RETENTION_YEARS, orderRetentionUntil } from "@/server/domain/orders/retention";

/** DSGVO Art. 15: all personal data about the user, as one JSON document. */
export async function selfReport(db: DbExecutor, userId: string, now = new Date()) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId));
  const ents = await db
    .select({ ent: entitlements, course: courses.title })
    .from(entitlements)
    .innerJoin(courses, eq(courses.id, entitlements.courseId))
    .where(eq(entitlements.userId, userId));
  const events = ents.length
    ? await db
        .select()
        .from(entitlementEvents)
        .where(
          inArray(
            entitlementEvents.entitlementId,
            ents.map((e) => e.ent.id),
          ),
        )
    : [];
  const progress = await db
    .select({
      lesson: lessons.title,
      completedAt: lessonProgress.completedAt,
      lastViewedAt: lessonProgress.lastViewedAt,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .where(eq(lessonProgress.userId, userId));
  const purchases = await db
    .select({ order: orders, product: products.title })
    .from(orders)
    .leftJoin(products, eq(products.id, orders.productId))
    .where(eq(orders.userId, userId));
  const [newsletter] = await db
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.email, user.email));
  const messages = await db
    .select()
    .from(contactMessages)
    .where(eq(contactMessages.userId, userId));
  const notes = await db.select().from(supportNotes).where(eq(supportNotes.userId, userId));
  const mails = await db
    .select({ kind: emailLog.kind, sentAt: emailLog.sentAt, status: emailLog.status })
    .from(emailLog)
    .where(eq(emailLog.userId, userId));

  return {
    generatedAt: now.toISOString(),
    controller: "Seelenzeit (www.seelenzeit.de)",
    account: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
    },
    profile: profile
      ? {
          customerType: profile.customerType,
          firstName: profile.firstName,
          lastName: profile.lastName,
          companyName: profile.companyName,
          vatId: profile.vatId,
          street: profile.street,
          postalCode: profile.postalCode,
          city: profile.city,
          country: profile.country,
        }
      : null,
    purchases: purchases.map(({ order, product }) => ({
      date: order.purchasedAt,
      product,
      provider: order.provider,
      receiptReference: order.receiptReference,
      amount: order.amountMinor === null ? null : order.amountMinor / 100,
      currency: order.currency,
      status: order.status,
      country: order.buyerCountry,
      customerType: order.customerType,
      companyName: order.companyName,
      vatId: order.vatId,
      billingAddress:
        [order.billingStreet, order.billingPostalCode, order.billingCity, order.billingCountry]
          .filter(Boolean)
          .join(", ") || null,
    })),
    courseAccess: ents.map(({ ent, course }) => ({
      course,
      state: entitlementState(ent, now),
      startsAt: ent.startsAt,
      expiresAt: ent.expiresAt,
      source: ent.source,
      history: events
        .filter((e) => e.entitlementId === ent.id)
        .map((e) => ({ type: e.type, at: e.createdAt, newExpiresAt: e.newExpiresAt })),
    })),
    learningProgress: progress,
    newsletter: newsletter
      ? {
          status: newsletter.status,
          subscribedAt: newsletter.subscribedAt,
          confirmedAt: newsletter.confirmedAt,
          unsubscribedAt: newsletter.unsubscribedAt,
          consentTextVersion: newsletter.consentTextVersion,
        }
      : null,
    supportMessages: messages.map((m) => ({
      date: m.createdAt,
      subject: m.subject,
      message: m.message,
      status: m.status,
    })),
    supportNotes: notes.map((n) => ({ date: n.createdAt, note: n.note })),
    emailsSent: mails,
  };
}

export class PrivacyError extends Error {}

/**
 * Account deletion (CLAUDE.md §6): personal data is anonymised, purchase records stay until
 * their statutory retention date (orders.retention_until) and are then purged by a job.
 */
export async function deleteAccount(
  db: DbExecutor,
  deps: { newsletter: NewsletterAdapter },
  input: { userId: string; actor: { id: string; role: string }; reason: string; now?: Date },
): Promise<void> {
  const now = input.now ?? new Date();
  const [user] = await db.select().from(users).where(eq(users.id, input.userId));
  if (!user || user.anonymizedAt)
    throw new PrivacyError("Konto nicht gefunden oder bereits gelöscht.");
  if (user.role !== "customer")
    throw new PrivacyError(
      "Mitarbeiterkonten bitte zuerst über die Mitarbeiterverwaltung zurückstufen.",
    );

  const [subscription] = await db
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.email, user.email));
  if (subscription?.syncedAt) await deps.newsletter.unsubscribe(user.email);

  await db.transaction(async (tx) => {
    const placeholder = `deleted-${user.id}@deleted.invalid`;
    await tx
      .update(users)
      .set({
        email: placeholder,
        name: "Gelöschtes Konto",
        image: null,
        emailVerified: false,
        twoFactorEnabled: false,
        anonymizedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.delete(accounts).where(eq(accounts.userId, user.id));
    await tx.delete(twoFactors).where(eq(twoFactors.userId, user.id));
    await tx.delete(verifications).where(eq(verifications.identifier, user.email));
    await tx
      .update(customerProfiles)
      .set({
        firstName: null,
        lastName: null,
        companyName: null,
        vatId: null,
        street: null,
        postalCode: null,
        city: null,
        updatedAt: now,
      })
      .where(eq(customerProfiles.userId, user.id));
    await tx
      .update(entitlements)
      .set({ status: "revoked", updatedAt: now })
      .where(and(eq(entitlements.userId, user.id), eq(entitlements.status, "active")));
    await tx.delete(lessonProgress).where(eq(lessonProgress.userId, user.id));
    await tx.delete(newsletterSubscriptions).where(eq(newsletterSubscriptions.email, user.email));
    await tx.delete(supportNotes).where(eq(supportNotes.userId, user.id));
    await tx
      .update(contactMessages)
      .set({ name: "–", email: placeholder, subject: "[gelöscht]", message: "[gelöscht]" })
      .where(eq(contactMessages.userId, user.id));
    await writeAudit(tx, {
      action: "account.deleted",
      actorUserId: input.actor.id,
      actorRole: input.actor.role,
      targetType: "user",
      targetId: user.id,
      reason: input.reason,
      metadata: { self: input.actor.id === user.id },
    });
  });
}

/** Daily job: removes purchase records (and their raw webhooks) after the retention period. */
export async function purgeExpiredRecords(
  db: DbExecutor,
  now = new Date(),
): Promise<{ orders: number; webhooks: number }> {
  return db.transaction(async (tx) => {
    const expired = await tx
      .select({
        id: orders.id,
        provider: orders.provider,
        transactionId: orders.transactionId,
        providerOrderId: orders.providerOrderId,
      })
      .from(orders)
      .where(lt(orders.retentionUntil, now));
    if (expired.length === 0) return { orders: 0, webhooks: 0 };
    await tx
      .update(entitlementEvents)
      .set({ orderId: null })
      .where(
        inArray(
          entitlementEvents.orderId,
          expired.map((o) => o.id),
        ),
      );
    await tx.delete(orders).where(
      inArray(
        orders.id,
        expired.map((o) => o.id),
      ),
    );
    const removedWebhooks = await tx
      .delete(webhookEvents)
      .where(
        inArray(
          webhookEvents.transactionId,
          expired.map((o) => o.transactionId),
        ),
      )
      .returning({ id: webhookEvents.id });
    // Refund/chargeback notifications carry their own transaction ids: purge by age as well.
    const oldWebhooks = await tx
      .delete(webhookEvents)
      .where(
        lt(
          webhookEvents.receivedAt,
          orderRetentionUntil(
            new Date(now.getTime() - 2 * ORDER_RETENTION_YEARS * 365 * 86_400_000),
          ),
        ),
      )
      .returning({ id: webhookEvents.id });
    removedWebhooks.push(...oldWebhooks);
    return { orders: expired.length, webhooks: removedWebhooks.length };
  });
}
