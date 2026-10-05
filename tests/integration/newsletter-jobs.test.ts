import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { MailAdapter, TransactionalMail } from "@/server/adapters/mail";
import type { NewsletterAdapter, NewsletterContact } from "@/server/adapters/newsletter";
import { emailLog, newsletterSubscriptions } from "@/server/db/schema";
import { grantAccess } from "@/server/services/access";
import { sendLoggedMail } from "@/server/services/mailer";
import {
  confirmNewsletter,
  subscribeNewsletter,
  syncPendingSubscriptions,
  syncSubscription,
  unsubscribeByToken,
} from "@/server/services/newsletter";
import { runDripNotifications, runExpiryReminders } from "@/server/services/notification-jobs";
import { closeTestDb, createUser, resetTables, testDb } from "../support/db";
import { createCourse, createProduct } from "../support/fixtures";

const db = testDb();
const mails: TransactionalMail[] = [];
const mail: MailAdapter = {
  async send(m) {
    mails.push(m);
    return { messageId: String(mails.length) };
  },
};
const synced: NewsletterContact[] = [];
const removed: string[] = [];
const newsletter: NewsletterAdapter = {
  async upsertConfirmedContact(c) {
    synced.push(c);
  },
  async unsubscribe(email) {
    removed.push(email);
  },
};
const deps = { mail, newsletter, appUrl: "https://app.test" };

const tokenFrom = (text: string, path: string) =>
  decodeURIComponent(text.match(new RegExp(`${path}\\?token=([^\\s]+)`))![1]!);

beforeEach(async () => {
  await resetTables(db);
  mails.length = 0;
  synced.length = 0;
  removed.length = 0;
});
afterAll(closeTestDb);

describe("newsletter double opt-in (AK-10)", () => {
  it("does not sync or send before confirmation, then syncs with DOI proof", async () => {
    await subscribeNewsletter(db, deps, {
      email: "Lea@Example.test",
      source: "website",
      ip: "203.0.113.9",
    });
    const [pending] = await db.select().from(newsletterSubscriptions);
    expect(pending).toMatchObject({
      email: "lea@example.test",
      status: "pending",
      subscribeIpTruncated: "203.0.113.0",
      consentTextVersion: "2026-10-01",
    });
    expect(await syncSubscription(db, newsletter, pending!.id)).toBe("refused");
    expect(await syncPendingSubscriptions(db, newsletter)).toBe(0);
    expect(synced).toEqual([]);

    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ kind: "newsletter_confirmation", to: "lea@example.test" });
    const token = tokenFrom(mails[0]!.text, "/newsletter/bestaetigen");
    expect(pending!.confirmTokenHash).not.toBe(token);

    expect(await confirmNewsletter(db, deps, { token, ip: "203.0.113.50" })).toBe("confirmed");
    const [confirmed] = await db.select().from(newsletterSubscriptions);
    expect(confirmed).toMatchObject({ status: "confirmed", confirmIpTruncated: "203.0.113.0" });
    expect(confirmed!.confirmedAt).toBeInstanceOf(Date);
    expect(synced).toEqual([
      expect.objectContaining({
        email: "lea@example.test",
        consent: expect.objectContaining({ consentTextVersion: "2026-10-01" }),
      }),
    ]);
  });

  it("rejects unknown and expired tokens", async () => {
    expect(await confirmNewsletter(db, deps, { token: "nope" })).toBe("invalid");
    await subscribeNewsletter(db, deps, {
      email: "alt@example.test",
      source: "website",
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const token = tokenFrom(mails[0]!.text, "/newsletter/bestaetigen");
    expect(
      await confirmNewsletter(db, deps, { token, now: new Date("2026-01-10T00:00:00Z") }),
    ).toBe("invalid");
  });

  it("unsubscribing removes the contact at the provider", async () => {
    await subscribeNewsletter(db, deps, { email: "weg@example.test", source: "website" });
    await confirmNewsletter(db, deps, {
      token: tokenFrom(mails[0]!.text, "/newsletter/bestaetigen"),
    });
    expect(
      await unsubscribeByToken(db, newsletter, tokenFrom(mails[0]!.text, "/newsletter/abmelden")),
    ).toBe(true);
    const [row] = await db.select().from(newsletterSubscriptions);
    expect(row?.status).toBe("unsubscribed");
    expect(removed).toEqual(["weg@example.test"]);
    expect(await syncSubscription(db, newsletter, row!.id)).toBe("refused");
  });

  it("confirmed subscribers are not asked again", async () => {
    await subscribeNewsletter(db, deps, { email: "ja@example.test", source: "website" });
    await confirmNewsletter(db, deps, {
      token: tokenFrom(mails[0]!.text, "/newsletter/bestaetigen"),
    });
    await subscribeNewsletter(db, deps, { email: "ja@example.test", source: "website" });
    expect(mails).toHaveLength(1);
  });
});

describe("transactional mail log", () => {
  it("sends a deduplicated mail only once and stores no address", async () => {
    const content = { subject: "s", html: "<p>h</p>", text: "t" };
    expect(
      await sendLoggedMail(db, mail, {
        kind: "support",
        to: "x@example.test",
        dedupeKey: "k1",
        content,
      }),
    ).toBe("sent");
    expect(
      await sendLoggedMail(db, mail, {
        kind: "support",
        to: "x@example.test",
        dedupeKey: "k1",
        content,
      }),
    ).toBe("skipped");
    const rows = await db.select().from(emailLog);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain("x@example.test");
  });

  it("frees the dedupe key on failure so the next run retries", async () => {
    const failing: MailAdapter = {
      async send() {
        throw new Error("down");
      },
    };
    const content = { subject: "s", html: "h", text: "t" };
    expect(
      await sendLoggedMail(db, failing, {
        kind: "support",
        to: "x@example.test",
        dedupeKey: "k2",
        content,
      }),
    ).toBe("failed");
    expect(
      await sendLoggedMail(db, mail, {
        kind: "support",
        to: "x@example.test",
        dedupeKey: "k2",
        content,
      }),
    ).toBe("sent");
  });
});

describe("scheduled mails", () => {
  it("sends module unlock mails once per module", async () => {
    const user = await createUser(db);
    const { course } = await createCourse(db, {
      modules: [{ unlockAfterDays: 0 }, { unlockAfterDays: 30 }],
    });
    await grantAccess(db, {
      userId: user.id,
      courseId: course.id,
      accessMonths: 24,
      source: "purchase",
      now: new Date("2026-01-01T06:00:00Z"),
    });
    const day31 = new Date("2026-01-31T07:00:00Z");
    expect(await runDripNotifications(db, mail, "https://app.test", day31)).toEqual({
      sent: 1,
      skipped: 0,
      failed: 0,
    });
    expect(await runDripNotifications(db, mail, "https://app.test", day31)).toEqual({
      sent: 0,
      skipped: 1,
      failed: 0,
    });
    expect(mails[0]).toMatchObject({ kind: "module_unlocked", to: user.email });
  });

  it("sends 30- and 7-day expiry reminders with the extension link, once each", async () => {
    const user = await createUser(db);
    const { course } = await createCourse(db);
    await createProduct(db, {
      courseId: course.id,
      tier: "small",
      kind: "extension",
      extensionMonths: 3,
      checkoutUrl: "https://checkout.test/verlaengern",
    });
    await grantAccess(db, {
      userId: user.id,
      courseId: course.id,
      accessMonths: 6,
      source: "purchase",
      now: new Date("2026-01-01T00:00:00Z"),
    });

    expect(
      (await runExpiryReminders(db, mail, "https://app.test", new Date("2026-06-05T08:00:00Z")))
        .sent,
    ).toBe(1);
    expect(
      (await runExpiryReminders(db, mail, "https://app.test", new Date("2026-06-06T08:00:00Z")))
        .sent,
    ).toBe(0);
    expect(
      (await runExpiryReminders(db, mail, "https://app.test", new Date("2026-06-26T08:00:00Z")))
        .sent,
    ).toBe(1);
    expect(mails.map((m) => m.kind)).toEqual(["expiry_reminder", "expiry_reminder"]);
    expect(mails[0]!.text).toContain("https://checkout.test/verlaengern");
    const logs = await db.select().from(emailLog).where(eq(emailLog.userId, user.id));
    expect(logs).toHaveLength(2);
  });
});
