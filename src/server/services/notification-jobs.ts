import { and, eq, gt, inArray, isNotNull } from "drizzle-orm";

import type { MailAdapter } from "@/server/adapters/mail";
import { courses, entitlements, modules, products, users } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import {
  dueExpiryReminder,
  dueModuleUnlocks,
  expiryDedupeKey,
  moduleUnlockDedupeKey,
} from "@/server/domain/notifications/schedule";
import { expiryReminderMail, moduleUnlockedMail } from "@/server/mail/templates";
import { sendLoggedMail } from "./mailer";

export interface JobReport {
  sent: number;
  skipped: number;
  failed: number;
}

function tally(report: JobReport, result: "sent" | "skipped" | "failed") {
  report[result] += 1;
}

/** Daily: mails for modules that were unlocked by drip (CLAUDE.md §5.2 – cron only for mails). */
export async function runDripNotifications(
  db: DbExecutor,
  mail: MailAdapter,
  appUrl: string,
  now = new Date(),
): Promise<JobReport> {
  const report: JobReport = { sent: 0, skipped: 0, failed: 0 };
  const rows = await db
    .select({
      ent: entitlements,
      course: courses,
      user: { id: users.id, email: users.email, name: users.name },
    })
    .from(entitlements)
    .innerJoin(courses, eq(courses.id, entitlements.courseId))
    .innerJoin(users, eq(users.id, entitlements.userId))
    .where(and(eq(entitlements.status, "active"), eq(users.role, "customer")));
  if (rows.length === 0) return report;
  const mods = await db
    .select()
    .from(modules)
    .where(
      and(
        inArray(modules.courseId, [...new Set(rows.map((r) => r.course.id))]),
        gt(modules.unlockAfterDays, 0),
      ),
    );

  for (const row of rows) {
    if (row.user.email.endsWith("@deleted.invalid")) continue;
    for (const mod of dueModuleUnlocks(
      row.ent,
      mods.filter((m) => m.courseId === row.course.id),
      now,
    )) {
      tally(
        report,
        await sendLoggedMail(db, mail, {
          kind: "module_unlocked",
          to: row.user.email,
          userId: row.user.id,
          dedupeKey: moduleUnlockDedupeKey(row.ent.id, mod.id),
          content: moduleUnlockedMail({
            courseTitle: row.course.title,
            moduleTitle: mod.title,
            url: `${appUrl}/konto/kurse/${row.course.slug}`,
            name: row.user.name,
          }),
        }),
      );
    }
  }
  return report;
}

/** Daily: reminders 30 and 7 days before expiry, with the extension checkout link. */
export async function runExpiryReminders(
  db: DbExecutor,
  mail: MailAdapter,
  appUrl: string,
  now = new Date(),
): Promise<JobReport> {
  const report: JobReport = { sent: 0, skipped: 0, failed: 0 };
  const rows = await db
    .select({
      ent: entitlements,
      course: courses,
      user: { id: users.id, email: users.email, name: users.name },
    })
    .from(entitlements)
    .innerJoin(courses, eq(courses.id, entitlements.courseId))
    .innerJoin(users, eq(users.id, entitlements.userId))
    .where(
      and(
        eq(entitlements.status, "active"),
        isNotNull(entitlements.expiresAt),
        gt(entitlements.expiresAt, now),
        eq(users.role, "customer"),
      ),
    );
  if (rows.length === 0) return report;
  const extensions = await db
    .select({ courseId: products.courseId, checkoutUrl: products.checkoutUrl })
    .from(products)
    .where(and(eq(products.kind, "extension"), eq(products.isPublished, true)));

  for (const row of rows) {
    const due = dueExpiryReminder(row.ent, now);
    if (!due || !row.ent.expiresAt || row.user.email.endsWith("@deleted.invalid")) continue;
    const extendUrl = extensions.find((e) => e.courseId === row.course.id)?.checkoutUrl ?? null;
    tally(
      report,
      await sendLoggedMail(db, mail, {
        kind: "expiry_reminder",
        to: row.user.email,
        userId: row.user.id,
        dedupeKey: expiryDedupeKey(row.ent.id, due.threshold, row.ent.expiresAt),
        content: expiryReminderMail({
          courseTitle: row.course.title,
          daysLeft: due.daysLeft,
          expiresAt: row.ent.expiresAt,
          extendUrl: extendUrl ?? `${appUrl}/konto/kurse/${row.course.slug}`,
          name: row.user.name,
        }),
      }),
    );
  }
  return report;
}
