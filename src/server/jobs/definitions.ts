import "server-only";

import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { mailAdapter } from "@/server/mail/send";
import { newsletterAdapter } from "@/server/newsletter/registry";
import { backupDeps } from "@/server/backup/registry";
import { runBackup, runRestoreTest } from "@/server/backup/run";
import { syncPendingSubscriptions } from "@/server/services/newsletter";
import { purgeExpiredRecords } from "@/server/services/privacy";
import { runDripNotifications, runExpiryReminders } from "@/server/services/notification-jobs";

export interface JobDefinition {
  name: string;
  /** Cron in Europe/Berlin. */
  cron: string;
  description: string;
  run: () => Promise<unknown>;
}

/** Scheduled background jobs (pg-boss). Access rights never depend on these (CLAUDE.md §5.2). */
export function jobDefinitions(): JobDefinition[] {
  const env = serverEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  return [
    {
      name: "drip-notifications",
      cron: "0 7 * * *",
      description: "Mails für per Drip freigeschaltete Module",
      run: () => runDripNotifications(db, mailAdapter(), appUrl),
    },
    {
      name: "expiry-reminders",
      cron: "0 8 * * *",
      description: "Ablauf-Erinnerungen 30 und 7 Tage vorher",
      run: () => runExpiryReminders(db, mailAdapter(), appUrl),
    },
    {
      name: "newsletter-sync",
      cron: "*/15 * * * *",
      description: "Bestätigte Newsletter-Kontakte zum Anbieter übertragen",
      run: () => syncPendingSubscriptions(db, newsletterAdapter()),
    },
    {
      name: "backup",
      cron: "30 2 * * *",
      description: "Verschlüsseltes Datenbank-Backup, Aufbewahrung 30 Tage",
      run: () => runBackup(db, backupDeps(env)),
    },
    {
      name: "restore-test",
      cron: "0 4 * * 0",
      description: "Wöchentlicher Restore-Test des neuesten Backups",
      run: () => runRestoreTest(db, backupDeps(env), { triggeredBy: "schedule" }),
    },
    {
      name: "retention-purge",
      cron: "15 3 * * *",
      description: "Kaufdaten nach Ablauf der Aufbewahrungsfrist löschen",
      run: () => purgeExpiredRecords(db),
    },
  ];
}
