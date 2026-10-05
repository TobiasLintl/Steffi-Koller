import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { MailAdapter } from "@/server/adapters/mail";
import type { NewsletterAdapter } from "@/server/adapters/newsletter";
import { newsletterSubscriptions, users } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import { truncateIp } from "@/server/domain/consent/consent";
import {
  canReceiveNewsletter,
  DOI_TOKEN_TTL_HOURS,
  hashToken,
  NEWSLETTER_CONSENT_VERSION,
  newToken,
} from "@/server/domain/newsletter/rules";
import { newsletterConfirmationMail } from "@/server/mail/templates";
import { sendLoggedMail } from "./mailer";

export interface NewsletterDeps {
  mail: MailAdapter;
  newsletter: NewsletterAdapter;
  appUrl: string;
}

/**
 * Starts double opt-in. Same response whether or not the address is known (no enumeration).
 * Confirmed subscriptions stay untouched; pending/unsubscribed ones get a fresh DOI mail.
 */
export async function subscribeNewsletter(
  db: DbExecutor,
  deps: NewsletterDeps,
  input: { email: string; source: string; ip?: string | null; userId?: string | null; now?: Date },
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const now = input.now ?? new Date();
  const [existing] = await db
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.email, email));
  if (existing?.status === "confirmed") return;

  const confirm = newToken();
  const unsubscribe = newToken();
  const linkedUser =
    input.userId ??
    (await db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0]?.id ??
    null;
  const values = {
    status: "pending" as const,
    source: input.source,
    consentTextVersion: NEWSLETTER_CONSENT_VERSION,
    confirmTokenHash: confirm.hash,
    confirmTokenExpiresAt: new Date(now.getTime() + DOI_TOKEN_TTL_HOURS * 3600 * 1000),
    unsubscribeTokenHash: unsubscribe.hash,
    subscribedAt: now,
    subscribeIpTruncated: truncateIp(input.ip),
    confirmedAt: null,
    confirmIpTruncated: null,
    unsubscribedAt: null,
    userId: linkedUser,
    updatedAt: now,
  };
  await db
    .insert(newsletterSubscriptions)
    .values({ email, ...values })
    .onConflictDoUpdate({ target: newsletterSubscriptions.email, set: values });

  await sendLoggedMail(db, deps.mail, {
    kind: "newsletter_confirmation",
    to: email,
    userId: linkedUser,
    content: newsletterConfirmationMail({
      url: `${deps.appUrl}/newsletter/bestaetigen?token=${encodeURIComponent(confirm.token)}`,
      unsubscribeUrl: `${deps.appUrl}/newsletter/abmelden?token=${encodeURIComponent(unsubscribe.token)}`,
    }),
  });
}

export async function confirmNewsletter(
  db: DbExecutor,
  deps: NewsletterDeps,
  input: { token: string; ip?: string | null; now?: Date },
): Promise<"confirmed" | "already" | "invalid"> {
  const now = input.now ?? new Date();
  const [sub] = await db
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.confirmTokenHash, hashToken(input.token)));
  if (!sub) return "invalid";
  if (sub.status === "confirmed") return "already";
  if (
    !sub.confirmTokenExpiresAt ||
    sub.confirmTokenExpiresAt.getTime() < now.getTime() ||
    sub.status !== "pending"
  )
    return "invalid";
  await db
    .update(newsletterSubscriptions)
    .set({
      status: "confirmed",
      confirmedAt: now,
      confirmIpTruncated: truncateIp(input.ip),
      updatedAt: now,
    })
    .where(eq(newsletterSubscriptions.id, sub.id));
  await syncSubscription(db, deps.newsletter, sub.id).catch(() => undefined); // retried by the worker
  return "confirmed";
}

/** Pushes one subscription to the provider. Refuses anything without confirmed DOI (AK-10). */
export async function syncSubscription(
  db: DbExecutor,
  newsletter: NewsletterAdapter,
  subscriptionId: string,
): Promise<"synced" | "refused"> {
  const [sub] = await db
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.id, subscriptionId));
  if (!sub || !canReceiveNewsletter(sub)) return "refused";
  try {
    const [user] = sub.userId
      ? await db.select({ name: users.name }).from(users).where(eq(users.id, sub.userId))
      : [];
    await newsletter.upsertConfirmedContact({
      email: sub.email,
      firstName: user?.name.split(" ")[0],
      consent: {
        subscribedAt: sub.subscribedAt,
        confirmedAt: sub.confirmedAt!,
        consentTextVersion: sub.consentTextVersion,
      },
    });
    await db
      .update(newsletterSubscriptions)
      .set({ syncedAt: new Date(), syncError: null })
      .where(eq(newsletterSubscriptions.id, sub.id));
    return "synced";
  } catch (error) {
    await db
      .update(newsletterSubscriptions)
      .set({ syncError: error instanceof Error ? error.message.slice(0, 300) : "unknown" })
      .where(eq(newsletterSubscriptions.id, sub.id));
    throw error;
  }
}

/** Worker: retries confirmed contacts that were not synced yet. */
export async function syncPendingSubscriptions(
  db: DbExecutor,
  newsletter: NewsletterAdapter,
): Promise<number> {
  const rows = await db
    .select({ id: newsletterSubscriptions.id })
    .from(newsletterSubscriptions)
    .where(
      and(
        eq(newsletterSubscriptions.status, "confirmed"),
        isNull(newsletterSubscriptions.syncedAt),
      ),
    )
    .limit(200);
  let synced = 0;
  for (const row of rows) {
    if ((await syncSubscription(db, newsletter, row.id).catch(() => "failed")) === "synced")
      synced += 1;
  }
  return synced;
}

async function markUnsubscribed(
  db: DbExecutor,
  newsletter: NewsletterAdapter,
  sub: { id: string; email: string; status: string; syncedAt: Date | null },
) {
  if (sub.status === "unsubscribed") return;
  await db
    .update(newsletterSubscriptions)
    .set({
      status: "unsubscribed",
      unsubscribedAt: new Date(),
      confirmTokenHash: null,
      updatedAt: new Date(),
    })
    .where(eq(newsletterSubscriptions.id, sub.id));
  if (sub.syncedAt) await newsletter.unsubscribe(sub.email);
}

export async function unsubscribeByToken(
  db: DbExecutor,
  newsletter: NewsletterAdapter,
  token: string,
): Promise<boolean> {
  const [sub] = await db
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.unsubscribeTokenHash, hashToken(token)));
  if (!sub) return false;
  await markUnsubscribed(db, newsletter, sub);
  return true;
}

export async function unsubscribeEmail(
  db: DbExecutor,
  newsletter: NewsletterAdapter,
  email: string,
): Promise<void> {
  const [sub] = await db
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.email, email.toLowerCase()));
  if (sub) await markUnsubscribed(db, newsletter, sub);
}

export async function newsletterStatusFor(db: DbExecutor, email: string) {
  const [sub] = await db
    .select()
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.email, email.toLowerCase()));
  return sub ?? null;
}

export async function newsletterStats(db: DbExecutor) {
  const rows = await db
    .select({ status: newsletterSubscriptions.status, n: sql<number>`count(*)::int` })
    .from(newsletterSubscriptions)
    .groupBy(newsletterSubscriptions.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<
    Record<"pending" | "confirmed" | "unsubscribed", number>
  >;
}

export async function listSubscriptions(db: DbExecutor, limit = 300) {
  return db
    .select()
    .from(newsletterSubscriptions)
    .orderBy(desc(newsletterSubscriptions.updatedAt))
    .limit(limit);
}
