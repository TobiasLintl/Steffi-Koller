import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { NewsletterAdapter } from "@/server/adapters/newsletter";
import { createLocalStorageAdapter } from "@/server/adapters/storage";
import { latestBackupKey, runBackup, runRestoreTest } from "@/server/backup/run";
import {
  auditLog,
  backupRuns,
  consentRecords,
  contactMessages,
  customerProfiles,
  entitlements,
  newsletterSubscriptions,
  orders,
  users,
} from "@/server/db/schema";
import { CONSENT_POLICY_VERSION } from "@/server/domain/consent/consent";
import { grantAccess } from "@/server/services/access";
import { createContactMessage } from "@/server/services/contact";
import { exportDataset, EXPORT_DATASETS, type ExportDataset } from "@/server/services/exports";
import {
  deleteAccount,
  PrivacyError,
  purgeExpiredRecords,
  selfReport,
} from "@/server/services/privacy";
import { closeTestDb, createUser, resetTables, testDb } from "../support/db";
import { createCourse, createProduct } from "../support/fixtures";

const db = testDb();
const removed: string[] = [];
const newsletter: NewsletterAdapter = {
  async upsertConfirmedContact() {},
  async unsubscribe(email) {
    removed.push(email);
  },
};

async function scenario() {
  const customer = await createUser(db, { email: "klara@example.test", name: "Klara Kundin" });
  await db
    .update(customerProfiles)
    .set({
      customerType: "b2b",
      companyName: "Klara GmbH",
      vatId: "DE123456789",
      city: "Berlin",
      country: "DE",
    })
    .where(eq(customerProfiles.userId, customer.id));
  const { course } = await createCourse(db, { title: "Achtsam" });
  const product = await createProduct(db, { courseId: course.id, tier: "small", accessMonths: 6 });
  await grantAccess(db, {
    userId: customer.id,
    courseId: course.id,
    accessMonths: 6,
    source: "purchase",
  });
  const purchasedAt = new Date("2026-03-01T10:00:00Z");
  await db.insert(orders).values({
    provider: "copecart",
    transactionId: "tx1",
    providerOrderId: "o1",
    providerProductId: "p1",
    productId: product.id,
    userId: customer.id,
    amountMinor: 5200,
    currency: "CHF",
    buyerCountry: "CH",
    customerType: "b2b",
    companyName: "Klara GmbH",
    vatId: "DE123456789",
    purchasedAt,
    retentionUntil: new Date("2036-03-01T10:00:00Z"),
  });
  await db.insert(newsletterSubscriptions).values({
    email: "klara@example.test",
    status: "confirmed",
    confirmedAt: new Date(),
    consentTextVersion: "2026-10-01",
    unsubscribeTokenHash: "h",
    syncedAt: new Date(),
  });
  await db.insert(consentRecords).values({
    consentId: "8f14e45f-ceea-4ed3-a1d1-1a4b5b8a7c11",
    statistics: false,
    marketing: false,
    policyVersion: CONSENT_POLICY_VERSION,
  });
  await createContactMessage(
    db,
    {
      name: "Klara",
      email: "klara@example.test",
      subject: "Frage",
      message: "Wie lange läuft mein Zugang?",
    },
    customer.id,
  );
  return { customer, course };
}

beforeEach(async () => {
  await resetTables(db);
  removed.length = 0;
});
afterAll(closeTestDb);

describe("AK-13: complete export of customers, purchases, access, consents and courses", () => {
  it.each(Object.keys(EXPORT_DATASETS) as ExportDataset[])("%s", async (dataset) => {
    await scenario();
    const rows = await exportDataset(db, dataset);
    expect(rows.length).toBeGreaterThan(0);
    const expectations: Record<ExportDataset, Record<string, unknown>> = {
      customers: {
        email: "klara@example.test",
        customerType: "b2b",
        companyName: "Klara GmbH",
        vatId: "DE123456789",
        country: "DE",
      },
      orders: {
        transactionId: "tx1",
        amount: "52.00",
        currency: "CHF",
        buyerCountry: "CH",
        customerType: "b2b",
        vatId: "DE123456789",
        customerEmail: "klara@example.test",
      },
      entitlements: {
        customerEmail: "klara@example.test",
        course: "Achtsam",
        state: "active",
        source: "purchase",
      },
      consents: {
        type: "newsletter",
        subject: "klara@example.test",
        status: "confirmed",
        version: "2026-10-01",
      },
      courses: { courseTitle: "Achtsam", lessonTitle: "Lektion 1.1" },
    };
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining(expectations[dataset])]));
    if (dataset === "consents") expect(rows.some((r) => r.type === "cookies")).toBe(true);
  });
});

describe("self report and account deletion", () => {
  it("self report contains the user's own data only", async () => {
    const { customer } = await scenario();
    const report = await selfReport(db, customer.id);
    expect(report?.account.email).toBe("klara@example.test");
    expect(report?.purchases).toEqual([
      expect.objectContaining({ currency: "CHF", amount: 52, vatId: "DE123456789" }),
    ]);
    expect(report?.courseAccess).toHaveLength(1);
    expect(report?.newsletter?.status).toBe("confirmed");
    expect(report?.supportMessages).toHaveLength(1);
  });

  it("anonymises personal data, ends access, keeps purchase records and audits the deletion", async () => {
    const { customer } = await scenario();
    await deleteAccount(
      db,
      { newsletter },
      {
        userId: customer.id,
        actor: { id: customer.id, role: "customer" },
        reason: "Selbst gelöscht",
      },
    );

    const [user] = await db.select().from(users).where(eq(users.id, customer.id));
    expect(user).toMatchObject({
      email: `deleted-${customer.id}@deleted.invalid`,
      name: "Gelöschtes Konto",
    });
    expect(user!.anonymizedAt).toBeInstanceOf(Date);
    const [profile] = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, customer.id));
    expect(profile).toMatchObject({ companyName: null, vatId: null, city: null });
    expect(
      (await db.select().from(entitlements).where(eq(entitlements.userId, customer.id)))[0]?.status,
    ).toBe("revoked");
    expect(await db.select().from(newsletterSubscriptions)).toHaveLength(0);
    expect(removed).toEqual(["klara@example.test"]);
    expect((await db.select().from(contactMessages))[0]).toMatchObject({ message: "[gelöscht]" });
    // Purchase record stays (statutory retention) …
    expect((await db.select().from(orders))[0]).toMatchObject({
      transactionId: "tx1",
      vatId: "DE123456789",
    });
    // … and the deletion itself is audited.
    expect(
      (await db.select().from(auditLog).where(eq(auditLog.targetId, customer.id))).map(
        (a) => a.action,
      ),
    ).toContain("account.deleted");
    // A second deletion is refused; staff accounts cannot be deleted this way.
    await expect(
      deleteAccount(
        db,
        { newsletter },
        { userId: customer.id, actor: { id: "x", role: "admin" }, reason: "x" },
      ),
    ).rejects.toBeInstanceOf(PrivacyError);
    const staff = await createUser(db, { role: "editor" });
    await expect(
      deleteAccount(
        db,
        { newsletter },
        { userId: staff.id, actor: { id: "x", role: "admin" }, reason: "x" },
      ),
    ).rejects.toBeInstanceOf(PrivacyError);
  });

  it("purges purchase records after their retention date", async () => {
    await scenario();
    expect(await purgeExpiredRecords(db, new Date("2030-01-01T00:00:00Z"))).toEqual({
      orders: 0,
      webhooks: 0,
    });
    expect((await purgeExpiredRecords(db, new Date("2036-03-02T00:00:00Z"))).orders).toBe(1);
    expect(await db.select().from(orders)).toHaveLength(0);
  });
});

describe("AK-14: backup can be restored", () => {
  it("creates an encrypted backup and restores it into a fresh database", async () => {
    await scenario();
    const storage = createLocalStorageAdapter({
      rootDir: mkdtempSync(path.join(tmpdir(), "sz-backup-")),
      baseUrl: "",
      signingSecret: "x",
    });
    const deps = {
      storage,
      databaseUrl: process.env.DATABASE_URL!,
      passphrase: "integration-test-passphrase",
      retentionDays: 30,
    };
    const backup = await runBackup(db, deps, { triggeredBy: "test" });
    expect(backup.key).toMatch(/^backups\/seelenzeit-\d{8}-\d{6}\.dump\.enc$/);
    const raw = await storage.getObject(backup.key);
    expect(Buffer.from(raw!).subarray(0, 5).toString()).toBe("SZBK1");
    expect(Buffer.from(raw!).includes(Buffer.from("klara@example.test"))).toBe(false); // encrypted at rest

    const result = await runRestoreTest(db, deps, { triggeredBy: "test" });
    expect(result.ok).toBe(true);
    expect(result.key).toBe(await latestBackupKey(storage));
    expect(
      (result.details.tables as Record<string, { restored: number; live: number }>).orders,
    ).toEqual({ restored: 1, live: 1 });
    const runs = await db.select().from(backupRuns);
    expect(runs.map((r) => [r.kind, r.status]).sort()).toEqual([
      ["backup", "succeeded"],
      ["restore_test", "succeeded"],
    ]);
  }, 60_000);
});
