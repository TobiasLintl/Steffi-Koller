import "server-only";

import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { mailAdapter } from "@/server/mail/send";
import { newsletterAdapter } from "@/server/newsletter/registry";
import { syncPendingSubscriptions } from "@/server/services/newsletter";
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
  const appUrl = serverEnv().NEXT_PUBLIC_APP_URL;
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
  ];
}
