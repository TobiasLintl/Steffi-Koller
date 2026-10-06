import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as copecartPost } from "@/app/api/webhooks/copecart/route";
import { POST as digistorePost } from "@/app/api/webhooks/digistore24/route";
import type { MailAdapter, TransactionalMail } from "@/server/adapters/mail";
import { createCopeCartAdapter } from "@/server/adapters/payment";
import {
  adminNotifications,
  customerProfiles,
  entitlementEvents,
  entitlements,
  orders,
  productProviderMappings,
  users,
  webhookEvents,
} from "@/server/db/schema";
import { addMonths } from "@/server/domain/access";
import { setMailAdapter } from "@/server/mail/send";
import { setSetting, REFUND_POLICY_KEY } from "@/server/services/settings";
import { reprocessWebhookEvent } from "@/server/services/webhooks";
import { refundPolicySchema } from "@/server/domain/orders/refund-policy";
import { closeTestDb, createUser, resetTables, testDb } from "../support/db";
import { createCourse, createProduct } from "../support/fixtures";
import { copecartFixture, copecartRequest, digistoreRequest } from "../support/webhooks";

const db = testDb();
const sent: TransactionalMail[] = [];
const captureMail: MailAdapter = {
  async send(mail) {
    sent.push(mail);
    return { messageId: `test-${sent.length}` };
  },
};

let smallCourseId = "";
let largeCourseId = "";

async function setupCatalog() {
  const small = await createCourse(db, { title: "Achtsam durch den Tag" });
  const large = await createCourse(db, { title: "Der Jahresweg" });
  smallCourseId = small.course.id;
  largeCourseId = large.course.id;
  const smallAccess = await createProduct(db, {
    courseId: small.course.id,
    tier: "small",
    accessMonths: 6,
  });
  const smallExt = await createProduct(db, {
    courseId: small.course.id,
    tier: "small",
    kind: "extension",
    extensionMonths: 3,
  });
  const largeAccess = await createProduct(db, {
    courseId: large.course.id,
    tier: "large",
    accessMonths: 24,
  });
  await db.insert(productProviderMappings).values([
    { provider: "copecart", providerProductId: "cc-small-001", productId: smallAccess.id },
    { provider: "copecart", providerProductId: "cc-small-ext-001", productId: smallExt.id },
    { provider: "copecart", providerProductId: "cc-large-001", productId: largeAccess.id },
    { provider: "digistore24", providerProductId: "ds-small-1", productId: smallAccess.id },
  ]);
  return { smallAccess };
}

async function deliver(name: string, overrides: Record<string, unknown> = {}) {
  const response = await copecartPost(copecartRequest(copecartFixture(name, overrides)));
  return { status: response.status, body: await response.text() };
}

async function entitlementFor(email: string, courseId: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return undefined;
  const rows = await db.select().from(entitlements).where(eq(entitlements.userId, user.id));
  return rows.find((r) => r.courseId === courseId);
}

beforeEach(async () => {
  await resetTables(db);
  sent.length = 0;
  setMailAdapter(captureMail);
  await setupCatalog();
});
afterAll(async () => {
  setMailAdapter(undefined);
  await closeTestDb();
});

describe("CopeCart webhook", () => {
  it("AK-01: a purchase creates the account, the order and unlocks the right course", async () => {
    expect(await deliver("payment-made-eur-b2c")).toEqual({ status: 200, body: "OK" });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, "lena.beispiel@example.test"));
    expect(user).toMatchObject({ name: "Lena Beispiel", role: "customer", emailVerified: false });
    const [order] = await db.select().from(orders).where(eq(orders.transactionId, "tx-eur-0001"));
    expect(order).toMatchObject({
      provider: "copecart",
      amountMinor: 4900,
      currency: "EUR",
      buyerCountry: "DE",
      customerType: "b2c",
      status: "paid",
      receiptReference: "ORD10001",
      userId: user!.id,
    });

    const ent = await entitlementFor("lena.beispiel@example.test", smallCourseId);
    expect(ent?.status).toBe("active");
    expect(ent?.expiresAt).toEqual(addMonths(ent!.startsAt, 6));
    expect(await entitlementFor("lena.beispiel@example.test", largeCourseId)).toBeUndefined();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "access_granted", to: "lena.beispiel@example.test" });
    expect(sent[0]!.text).toContain("/konto/kurse/");
  });

  it("the large course is unlocked for 24 months", async () => {
    await deliver("payment-made-large");
    const ent = await entitlementFor("lena.beispiel@example.test", largeCourseId);
    expect(ent?.expiresAt).toEqual(addMonths(ent!.startsAt, 24));
  });

  it("duplicate and concurrent deliveries never create duplicate access", async () => {
    const results = await Promise.all([
      deliver("payment-made-eur-b2c"),
      deliver("payment-made-eur-b2c"),
      deliver("payment-made-eur-b2c"),
    ]);
    expect(results.every((r) => r.status === 200 && r.body === "OK")).toBe(true);
    expect(await deliver("payment-made-eur-b2c")).toEqual({ status: 200, body: "OK" });

    expect(await db.select().from(orders)).toHaveLength(1);
    expect(await db.select().from(webhookEvents)).toHaveLength(1);
    const ents = await db.select().from(entitlements);
    expect(ents).toHaveLength(1);
    expect(
      await db
        .select()
        .from(entitlementEvents)
        .where(eq(entitlementEvents.entitlementId, ents[0]!.id)),
    ).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it("AK-03: a Swiss customer buys in CHF", async () => {
    expect((await deliver("payment-made-chf-b2c")).status).toBe(200);
    const [order] = await db.select().from(orders).where(eq(orders.transactionId, "tx-chf-0001"));
    expect(order).toMatchObject({ currency: "CHF", amountMinor: 5200, buyerCountry: "CH" });
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, "urs.beispiel@example.test"));
    const [profile] = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, user!.id));
    expect(profile?.country).toBe("CH");
  });

  it("AK-04: B2B company data is stored on the order and the customer profile", async () => {
    await deliver("payment-made-eur-b2b");
    const [order] = await db.select().from(orders).where(eq(orders.transactionId, "tx-b2b-0001"));
    expect(order).toMatchObject({
      customerType: "b2b",
      companyName: "Beispiel Coaching GmbH",
      vatId: "DE315024481",
      billingStreet: "Teststraße 3",
      billingPostalCode: "10115",
      billingCity: "Berlin",
      billingCountry: "DE",
    });
    const [profile] = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, order!.userId!));
    expect(profile).toMatchObject({
      customerType: "b2b",
      companyName: "Beispiel Coaching GmbH",
      vatId: "DE315024481",
      city: "Berlin",
    });
  });

  it("AK-06: an extension purchase extends the existing entitlement by 3 months, once", async () => {
    await deliver("payment-made-eur-b2c");
    const before = await entitlementFor("lena.beispiel@example.test", smallCourseId);
    await deliver("payment-made-extension");
    await deliver("payment-made-extension");
    const after = await entitlementFor("lena.beispiel@example.test", smallCourseId);
    expect(after?.id).toBe(before?.id);
    expect(after?.expiresAt).toEqual(addMonths(before!.expiresAt!, 3));
    expect(await db.select().from(entitlements)).toHaveLength(1);
    expect(sent.map((m) => m.subject)).toEqual([
      expect.stringContaining("Dein Zugang"),
      expect.stringContaining("Verlängert"),
    ]);
  });

  it("an existing account is matched by e-mail, case-insensitively", async () => {
    const existing = await createUser(db, { email: "lena.beispiel@example.test" });
    await deliver("payment-made-eur-b2c", { buyer_email: "Lena.Beispiel@Example.TEST" });
    expect(await db.select().from(users)).toHaveLength(1);
    expect((await entitlementFor("lena.beispiel@example.test", smallCourseId))?.userId).toBe(
      existing.id,
    );
  });

  it("AK-02: a refund revokes access per policy and notifies the admin", async () => {
    await deliver("payment-made-eur-b2c");
    sent.length = 0;
    expect(await deliver("payment-refunded")).toEqual({ status: 200, body: "OK" });

    const [order] = await db.select().from(orders).where(eq(orders.transactionId, "tx-eur-0001"));
    expect(order?.status).toBe("refunded");
    expect((await entitlementFor("lena.beispiel@example.test", smallCourseId))?.status).toBe(
      "revoked",
    );
    const notes = await db.select().from(adminNotifications);
    expect(notes.map((n) => n.kind)).toContain("order_refunded");
    expect(notes[0]!.body).not.toContain("lena.beispiel");
    expect(sent).toEqual([
      expect.objectContaining({ kind: "admin_notification", to: "admin@example.test" }),
    ]);
  });

  it("AK-02: with policy 'keep' a refund leaves access untouched", async () => {
    const admin = await createUser(db, { role: "admin" });
    await setSetting(db, { id: admin.id, role: "admin" }, REFUND_POLICY_KEY, refundPolicySchema, {
      action: "keep",
      notifyAdmin: false,
    });
    await deliver("payment-made-eur-b2c");
    await deliver("payment-refunded");
    expect((await entitlementFor("lena.beispiel@example.test", smallCourseId))?.status).toBe(
      "active",
    );
  });

  it("a refunded extension rolls back the extension months", async () => {
    await deliver("payment-made-eur-b2c");
    const base = await entitlementFor("lena.beispiel@example.test", smallCourseId);
    await deliver("payment-made-extension");
    await deliver("payment-refunded", {
      order_id: "ORD10005",
      product_id: "cc-small-ext-001",
      transaction_id: "tx-ext-0001-refund",
    });
    const after = await entitlementFor("lena.beispiel@example.test", smallCourseId);
    expect(after).toMatchObject({ status: "active", expiresAt: base!.expiresAt });
  });

  it("a chargeback blocks access", async () => {
    await deliver("payment-made-chf-b2c");
    await deliver("payment-charged-back");
    const [order] = await db.select().from(orders).where(eq(orders.transactionId, "tx-chf-0001"));
    expect(order?.status).toBe("chargeback");
    expect((await entitlementFor("urs.beispiel@example.test", smallCourseId))?.status).toBe(
      "revoked",
    );
  });

  it("a refund arriving before its purchase fails and succeeds on redelivery", async () => {
    expect((await deliver("payment-refunded")).status).toBe(500);
    await deliver("payment-made-eur-b2c");
    expect(await deliver("payment-refunded")).toEqual({ status: 200, body: "OK" });
    expect((await entitlementFor("lena.beispiel@example.test", smallCourseId))?.status).toBe(
      "revoked",
    );
  });

  it("unknown event types are stored and acknowledged without side effects", async () => {
    expect(await deliver("payment-pending")).toEqual({ status: 200, body: "OK" });
    const [event] = await db.select().from(webhookEvents);
    expect(event).toMatchObject({ status: "ignored", providerEventType: "payment.pending" });
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it("test payments are processed and flagged", async () => {
    await deliver("payment-made-test");
    const [order] = await db.select().from(orders);
    expect(order?.isTest).toBe(true);
  });

  it("rejects invalid signatures without storing anything", async () => {
    const response = await copecartPost(
      copecartRequest(copecartFixture("payment-made-eur-b2c"), "wrong-secret"),
    );
    expect(response.status).toBe(401);
    expect(await db.select().from(webhookEvents)).toHaveLength(0);
  });

  it("rejects oversized payloads", async () => {
    const response = await copecartPost(
      copecartRequest(copecartFixture("payment-made-eur-b2c", { padding: "x".repeat(70_000) })),
    );
    expect(response.status).toBe(413);
  });

  it("unmapped products fail, notify the admin and can be reprocessed after mapping", async () => {
    expect((await deliver("payment-made-unmapped")).status).toBe(500);
    const [failed] = await db.select().from(webhookEvents);
    expect(failed).toMatchObject({ status: "failed" });
    expect(failed!.error).toContain("cc-unknown-999");
    expect((await db.select().from(adminNotifications)).map((n) => n.kind)).toEqual([
      "webhook_failed",
    ]);

    const [product] = await db
      .select({ id: productProviderMappings.productId })
      .from(productProviderMappings)
      .where(eq(productProviderMappings.providerProductId, "cc-small-001"));
    await db.insert(productProviderMappings).values({
      provider: "copecart",
      providerProductId: "cc-unknown-999",
      productId: product!.id,
    });
    const outcome = await reprocessWebhookEvent(
      db,
      createCopeCartAdapter({ secret: "unused" }),
      failed!.id,
    );
    expect(outcome.kind).toBe("processed");
    expect(await db.select().from(orders)).toHaveLength(1);
  });
});

describe("Digistore24 IPN", () => {
  it("processes a purchase with sha_sign verification", async () => {
    const response = await digistorePost(digistoreRequest("on-payment"));
    expect([response.status, await response.text()]).toEqual([200, "OK"]);
    expect((await entitlementFor("ds.kundin@example.test", smallCourseId))?.status).toBe("active");
    const bad = await digistorePost(digistoreRequest("on-payment", "wrong"));
    expect(bad.status).toBe(401);
  });
});
