import { and, eq } from "drizzle-orm";

import type { NormalizedPaymentEvent, PaymentAdapter } from "@/server/adapters/payment";
import { WebhookPayloadError } from "@/server/adapters/payment";
import {
  courses,
  orders,
  productProviderMappings,
  products,
  webhookEvents,
} from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import { refundAction } from "@/server/domain/orders/refund-policy";
import { orderRetentionUntil } from "@/server/domain/orders/retention";
import { extendAccess, grantAccess, reduceAccess, revokeAccess } from "./access";
import { findOrCreateCustomer } from "./customers";
import { createAdminNotification } from "./notifications";
import { getRefundPolicy } from "./settings";

/** Side effects that run after the transaction has committed. */
export type WebhookEffect =
  | {
      type: "access_mail";
      variant: "granted" | "extended";
      userId: string;
      email: string;
      name: string;
      courseTitle: string;
      courseSlug: string;
      expiresAt: Date | null;
    }
  | { type: "admin_mail"; title: string; body: string; link: string };

export type WebhookOutcome =
  | { kind: "invalid_signature" }
  | { kind: "bad_payload"; error: string }
  | { kind: "ping" }
  | { kind: "duplicate"; eventId: string }
  | { kind: "ignored"; eventId: string }
  | { kind: "processed"; eventId: string; effects: WebhookEffect[] }
  | { kind: "failed"; eventId: string; error: string; effects: WebhookEffect[] };

class ProcessingError extends Error {}

export function eventKeyOf(
  event: Pick<NormalizedPaymentEvent, "provider" | "transactionId" | "providerEventType">,
): string {
  return `${event.provider}:${event.transactionId}:${event.providerEventType}`;
}

/**
 * Webhook pipeline (CLAUDE.md §5.3): verify → store raw payload → process idempotently.
 * Duplicate or late deliveries never create duplicate access or double extensions.
 */
export async function receiveWebhook(
  db: DbExecutor,
  adapter: PaymentAdapter,
  request: { headers: Headers; rawBody: string },
  now = new Date(),
): Promise<WebhookOutcome> {
  if (!adapter.verify(request)) return { kind: "invalid_signature" };

  let event: NormalizedPaymentEvent | null;
  try {
    event = adapter.parse(request);
  } catch (error) {
    if (error instanceof WebhookPayloadError) return { kind: "bad_payload", error: error.message };
    throw error;
  }
  if (!event) return { kind: "ping" };

  const [stored] = await db
    .insert(webhookEvents)
    .values({
      provider: adapter.provider,
      eventKey: eventKeyOf(event),
      providerEventType: event.providerEventType,
      transactionId: event.transactionId,
      rawBody: request.rawBody,
    })
    .onConflictDoNothing({ target: webhookEvents.eventKey })
    .returning({ id: webhookEvents.id });
  const eventId =
    stored?.id ??
    (
      await db
        .select({ id: webhookEvents.id })
        .from(webhookEvents)
        .where(eq(webhookEvents.eventKey, eventKeyOf(event)))
    )[0]?.id;
  if (!eventId) throw new Error("Webhook event could not be stored");

  return processStoredEvent(db, eventId, event, now);
}

/** Re-runs a stored (failed) event, e.g. after the admin added a missing product mapping. */
export async function reprocessWebhookEvent(
  db: DbExecutor,
  adapter: PaymentAdapter,
  eventId: string,
  now = new Date(),
): Promise<WebhookOutcome> {
  const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, eventId));
  if (!row || row.provider !== adapter.provider) throw new Error("Webhook event not found");
  const event = adapter.parse({ headers: new Headers(), rawBody: row.rawBody });
  if (!event) return { kind: "ping" };
  return processStoredEvent(db, eventId, event, now);
}

async function processStoredEvent(
  db: DbExecutor,
  eventId: string,
  event: NormalizedPaymentEvent,
  now: Date,
): Promise<WebhookOutcome> {
  try {
    return await db.transaction(async (tx) => {
      // Row lock: concurrent deliveries of the same event are processed exactly once.
      const [locked] = await tx
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.id, eventId))
        .for("update");
      if (!locked) throw new Error("Webhook event vanished");
      if (locked.status === "processed" || locked.status === "ignored")
        return { kind: "duplicate", eventId } as const;

      let effects: WebhookEffect[] = [];
      let status: "processed" | "ignored" = "processed";
      if (event.type === "purchase") effects = await handlePurchase(tx, event, now);
      else if (event.type === "refund" || event.type === "chargeback")
        effects = await handleReversal(tx, event, now);
      else status = "ignored"; // unknown/unsupported event types: stored and logged, never a crash

      await tx
        .update(webhookEvents)
        .set({ status, processedAt: now, error: null, attempts: locked.attempts + 1 })
        .where(eq(webhookEvents.id, eventId));
      return status === "ignored"
        ? ({ kind: "ignored", eventId } as const)
        : ({ kind: "processed", eventId, effects } as const);
    });
  } catch (error) {
    const message =
      error instanceof ProcessingError ? error.message : "Interner Fehler bei der Verarbeitung";
    if (!(error instanceof ProcessingError)) console.error("[webhook] processing failed", error);
    const [row] = await db
      .select({ attempts: webhookEvents.attempts })
      .from(webhookEvents)
      .where(eq(webhookEvents.id, eventId));
    await db
      .update(webhookEvents)
      .set({ status: "failed", error: message, attempts: (row?.attempts ?? 0) + 1 })
      .where(eq(webhookEvents.id, eventId));
    const title = `Webhook konnte nicht verarbeitet werden (${event.provider})`;
    const body = `${message}. Ereignis ${event.providerEventType}, Transaktion ${event.transactionId}.`;
    const link = `/admin/webhooks/${eventId}`;
    // Only notify on the first failure; the reseller retries several times.
    if ((row?.attempts ?? 0) === 0)
      await createAdminNotification(db, { kind: "webhook_failed", title, body, link });
    return {
      kind: "failed",
      eventId,
      error: message,
      effects: (row?.attempts ?? 0) === 0 ? [{ type: "admin_mail", title, body, link }] : [],
    };
  }
}

async function findMappedProduct(tx: DbExecutor, event: NormalizedPaymentEvent) {
  const [row] = await tx
    .select({ product: products })
    .from(productProviderMappings)
    .innerJoin(products, eq(products.id, productProviderMappings.productId))
    .where(
      and(
        eq(productProviderMappings.provider, event.provider),
        eq(productProviderMappings.providerProductId, event.providerProductId),
      ),
    );
  if (!row) {
    throw new ProcessingError(
      `Keine Produktzuordnung für ${event.provider}-Produkt ${event.providerProductId}`,
    );
  }
  return row.product;
}

async function handlePurchase(
  tx: DbExecutor,
  event: NormalizedPaymentEvent,
  now: Date,
): Promise<WebhookEffect[]> {
  const product = await findMappedProduct(tx, event);
  const [existing] = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.provider, event.provider), eq(orders.transactionId, event.transactionId)));
  if (existing) return []; // same transaction already booked

  const customer = await findOrCreateCustomer(tx, {
    email: event.buyerEmail,
    firstName: event.buyerFirstName,
    lastName: event.buyerLastName,
    country: event.buyerCountry,
    customerType: event.customerType,
    billing: event.billing,
  });

  const [order] = await tx
    .insert(orders)
    .values({
      provider: event.provider,
      transactionId: event.transactionId,
      providerOrderId: event.providerOrderId,
      providerProductId: event.providerProductId,
      productId: product.id,
      userId: customer.id,
      amountMinor: event.amountMinor,
      currency: event.currency,
      buyerCountry: event.buyerCountry,
      customerType: event.customerType,
      companyName: event.billing.companyName,
      vatId: event.billing.vatId,
      billingStreet: event.billing.street,
      billingPostalCode: event.billing.postalCode,
      billingCity: event.billing.city,
      billingCountry: event.billing.country,
      receiptReference: event.receiptReference,
      paymentMethod: event.paymentMethod,
      isTest: event.isTest,
      purchasedAt: event.occurredAt,
      retentionUntil: orderRetentionUntil(event.occurredAt),
    })
    .returning({ id: orders.id });

  if (product.kind === "coaching" || !product.courseId) {
    const title = "Neuer Coaching-Kauf";
    const body = `Produkt „${product.title}“ wurde gekauft. Bitte Termin abstimmen.`;
    const link = `/admin/kunden/${customer.id}`;
    await createAdminNotification(tx, { kind: "coaching_purchase", title, body, link });
    return [{ type: "admin_mail", title, body, link }];
  }

  const [course] = await tx.select().from(courses).where(eq(courses.id, product.courseId));
  if (!course) throw new ProcessingError(`Kurs zu Produkt ${product.slug} fehlt`);

  const reason = `Kauf ${event.provider} ${event.providerOrderId}`;
  if (product.kind === "extension") {
    if (!product.extensionMonths)
      throw new ProcessingError(
        `Verlängerungsprodukt ${product.slug} hat keine Verlängerungsdauer`,
      );
    const change = await extendAccess(tx, {
      userId: customer.id,
      courseId: course.id,
      months: product.extensionMonths,
      source: "purchase",
      orderId: order!.id,
      reason,
      now,
    });
    if (change.result === "skipped_revoked") {
      const title = "Verlängerung für gesperrten Zugang gekauft";
      const body = `Für „${course.title}“ wurde eine Verlängerung gekauft, der Zugang ist aber gesperrt. Bitte prüfen.`;
      const link = `/admin/kunden/${customer.id}`;
      await createAdminNotification(tx, { kind: "extension_on_revoked", title, body, link });
      return [{ type: "admin_mail", title, body, link }];
    }
    return [accessMail("extended", customer, course, change.expiresAt)];
  }

  const change = await grantAccess(tx, {
    userId: customer.id,
    courseId: course.id,
    accessMonths: product.accessMonths,
    source: "purchase",
    orderId: order!.id,
    reason,
    now,
  });
  return [
    accessMail(
      change.result === "extended" ? "extended" : "granted",
      customer,
      course,
      change.expiresAt,
    ),
  ];
}

function accessMail(
  variant: "granted" | "extended",
  customer: { id: string; email: string; name: string },
  course: { title: string; slug: string },
  expiresAt: Date | null,
): WebhookEffect {
  return {
    type: "access_mail",
    variant,
    userId: customer.id,
    email: customer.email,
    name: customer.name,
    courseTitle: course.title,
    courseSlug: course.slug,
    expiresAt,
  };
}

async function handleReversal(
  tx: DbExecutor,
  event: NormalizedPaymentEvent,
  now: Date,
): Promise<WebhookEffect[]> {
  const [order] = await tx
    .select({ order: orders, product: products })
    .from(orders)
    .leftJoin(products, eq(products.id, orders.productId))
    .where(
      and(
        eq(orders.provider, event.provider),
        eq(orders.providerOrderId, event.providerOrderId),
        eq(orders.providerProductId, event.providerProductId),
      ),
    )
    .for("update", { of: orders });
  if (!order) {
    // Late or out-of-order delivery: fail so the reseller retries after the purchase arrived.
    throw new ProcessingError(`Ursprünglicher Kauf ${event.providerOrderId} nicht gefunden`);
  }
  if (order.order.status !== "paid") return [];

  const newStatus = event.type === "chargeback" ? "chargeback" : "refunded";
  await tx
    .update(orders)
    .set({ status: newStatus, refundedAt: now, updatedAt: now })
    .where(eq(orders.id, order.order.id));

  const policy = await getRefundPolicy(tx);
  const action = order.product ? refundAction(policy, order.product.kind) : "none";
  const label = event.type === "chargeback" ? "Rücklastschrift" : "Rückerstattung";
  const reason = `${label} ${event.provider} ${event.providerOrderId}`;
  if (order.order.userId && order.product?.courseId) {
    if (action === "revoke_entitlement") {
      await revokeAccess(tx, {
        userId: order.order.userId,
        courseId: order.product.courseId,
        orderId: order.order.id,
        reason,
        now,
      });
    } else if (action === "rollback_extension" && order.product.extensionMonths) {
      await reduceAccess(tx, {
        userId: order.order.userId,
        courseId: order.product.courseId,
        months: order.product.extensionMonths,
        orderId: order.order.id,
        reason,
        now,
      });
    }
  }

  if (!policy.notifyAdmin) return [];
  const title = `${label} eingegangen`;
  const body = `${label} für „${order.product?.title ?? event.providerProductId}“ (${event.provider} ${event.providerOrderId}). Zugang: ${
    action === "revoke_entitlement"
      ? "gesperrt"
      : action === "rollback_extension"
        ? "Verlängerung zurückgenommen"
        : "unverändert"
  }.`;
  const link = order.order.userId ? `/admin/kunden/${order.order.userId}` : "/admin/kaeufe";
  await createAdminNotification(tx, { kind: `order_${newStatus}`, title, body, link });
  return [{ type: "admin_mail", title, body, link }];
}
