import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { consentRecords, contactMessages, entitlements } from "@/server/db/schema";
import { CONSENT_POLICY_VERSION } from "@/server/domain/consent/consent";
import { claimFreeProduct, listPublicOffers } from "@/server/services/catalog";
import { recordConsent } from "@/server/services/consent";
import { createContactMessage } from "@/server/services/contact";
import { getPage, savePage } from "@/server/services/content";
import { closeTestDb, createUser, resetTables, testDb } from "../support/db";
import { createCourse, createProduct } from "../support/fixtures";

const db = testDb();
beforeEach(() => resetTables(db));
afterAll(closeTestDb);

describe("free products (lead magnet)", () => {
  it("grants unlimited access once and never extends on repeated claims", async () => {
    const user = await createUser(db);
    const { course } = await createCourse(db);
    const product = await createProduct(db, {
      courseId: course.id,
      tier: "free",
      accessMonths: null,
    });
    expect(await claimFreeProduct(db, user.id, product.id)).toEqual({
      status: "granted",
      courseSlug: course.slug,
    });
    expect(await claimFreeProduct(db, user.id, product.id)).toEqual({
      status: "already",
      courseSlug: course.slug,
    });
    const rows = await db.select().from(entitlements).where(eq(entitlements.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "free", expiresAt: null });
  });

  it("paid products cannot be claimed for free", async () => {
    const user = await createUser(db);
    const { course } = await createCourse(db);
    const product = await createProduct(db, {
      courseId: course.id,
      tier: "small",
      accessMonths: 6,
    });
    expect(await claimFreeProduct(db, user.id, product.id)).toEqual({ status: "not_found" });
  });

  it("free products are not listed as paid offers", async () => {
    const { course } = await createCourse(db);
    await createProduct(db, { courseId: course.id, tier: "free" });
    await createProduct(db, {
      courseId: course.id,
      tier: "small",
      kind: "extension",
      extensionMonths: 3,
    });
    expect(await listPublicOffers(db)).toEqual([]);
  });
});

describe("CMS", () => {
  it("falls back to defaults and stores edits", async () => {
    const admin = await createUser(db, { role: "editor" });
    expect((await getPage(db, "impressum"))?.blocks[0]).toMatchObject({ type: "text" });
    await savePage(db, admin.id, "impressum", {
      blocks: [{ id: "x", type: "text", heading: "", body: "Seelenzeit, Musterstraße 1" }],
    });
    expect((await getPage(db, "impressum"))?.blocks).toEqual([
      { id: "x", type: "text", heading: "", body: "Seelenzeit, Musterstraße 1" },
    ]);
    expect(await getPage(db, "does-not-exist")).toBeNull();
  });
});

describe("contact and consent", () => {
  it("links contact messages to an existing customer account by e-mail", async () => {
    const user = await createUser(db, { email: "klara@example.test" });
    const id = await createContactMessage(db, {
      name: "Klara",
      email: "Klara@Example.test",
      subject: "Frage",
      message: "Wie lange läuft mein Zugang?",
    });
    const [row] = await db.select().from(contactMessages).where(eq(contactMessages.id, id));
    expect(row).toMatchObject({ userId: user.id, email: "klara@example.test", status: "open" });
  });

  it("stores consent proof with truncated IP and policy version", async () => {
    const consentId = "8f14e45f-ceea-4ed3-a1d1-1a4b5b8a7c11";
    await recordConsent(
      db,
      { id: consentId, v: CONSENT_POLICY_VERSION, statistics: true, marketing: false },
      { ip: "198.51.100.77", userAgent: "Test" },
    );
    const [row] = await db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.consentId, consentId));
    expect(row).toMatchObject({
      statistics: true,
      marketing: false,
      ipTruncated: "198.51.100.0",
      policyVersion: CONSENT_POLICY_VERSION,
    });
  });
});
