import { bigint, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const backupKindEnum = pgEnum("backup_kind", ["backup", "restore_test"]);
export const backupStatusEnum = pgEnum("backup_status", ["running", "succeeded", "failed"]);

/** Backup and restore-test runs (AK-14), visible in the admin. */
export const backupRuns = pgTable(
  "backup_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: backupKindEnum().notNull(),
    status: backupStatusEnum().notNull().default("running"),
    storageKey: text(),
    sizeBytes: bigint({ mode: "number" }),
    details: jsonb().$type<Record<string, unknown>>(),
    error: text(),
    triggeredBy: text(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("backup_runs_started_idx").on(t.startedAt)],
);
