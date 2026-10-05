import { spawn } from "node:child_process";

import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { StorageAdapter } from "@/server/adapters/storage";
import { backupRuns } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import {
  backupKey,
  decryptBackup,
  encryptBackup,
  expiredBackupKeys,
} from "@/server/domain/backup/crypto";

export interface BackupDeps {
  storage: StorageAdapter;
  databaseUrl: string;
  passphrase: string;
  retentionDays: number;
  pgDump?: string;
  pgRestore?: string;
}

function run(command: string, args: string[], input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.stderr.on("data", (c: Buffer) => err.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      // stderr of pg tools contains no data rows, only messages.
      else
        reject(
          new Error(
            `${command} exited with ${code}: ${Buffer.concat(err).toString().slice(0, 500)}`,
          ),
        );
    });
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

/** Nightly backup (AK-14): pg_dump → AES-256-GCM → external storage; keeps `retentionDays`. */
export async function runBackup(
  db: DbExecutor,
  deps: BackupDeps,
  options: { now?: Date; triggeredBy?: string } = {},
) {
  const now = options.now ?? new Date();
  const [runRow] = await db
    .insert(backupRuns)
    .values({ kind: "backup", triggeredBy: options.triggeredBy ?? "schedule", startedAt: now })
    .returning({ id: backupRuns.id });
  try {
    const dump = await run(deps.pgDump ?? "pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      deps.databaseUrl,
    ]);
    const encrypted = encryptBackup(dump, deps.passphrase);
    const key = backupKey(now);
    await deps.storage.putObject(key, encrypted, "application/octet-stream");
    const expired = expiredBackupKeys(await deps.storage.list("backups/"), now, deps.retentionDays);
    for (const old of expired) await deps.storage.deleteObject(old);
    await db
      .update(backupRuns)
      .set({
        status: "succeeded",
        storageKey: key,
        sizeBytes: encrypted.length,
        finishedAt: new Date(),
        details: { dumpBytes: dump.length, deletedOldBackups: expired.length },
      })
      .where(eq(backupRuns.id, runRow!.id));
    return { key, sizeBytes: encrypted.length, deleted: expired.length };
  } catch (error) {
    await db
      .update(backupRuns)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 1000) : "unknown",
        finishedAt: new Date(),
      })
      .where(eq(backupRuns.id, runRow!.id));
    throw error;
  }
}

export async function latestBackupKey(storage: StorageAdapter): Promise<string | undefined> {
  return (await storage.list("backups/"))
    .filter((k) => k.endsWith(".dump.enc"))
    .sort()
    .at(-1);
}

/** Restores a backup into `targetUrl` (an empty database). */
export async function restoreBackup(
  deps: BackupDeps,
  key: string,
  targetUrl: string,
  options: { clean?: boolean } = {},
) {
  const file = await deps.storage.getObject(key);
  if (!file) throw new Error(`Backup ${key} not found`);
  const dump = decryptBackup(Buffer.from(file), deps.passphrase);
  const args = ["--no-owner", "--no-privileges", "--exit-on-error", "--dbname", targetUrl];
  if (options.clean) args.unshift("--clean", "--if-exists");
  await run(deps.pgRestore ?? "pg_restore", args, dump);
}

const CHECK_TABLES = [
  "users",
  "customer_profiles",
  "orders",
  "entitlements",
  "courses",
  "lessons",
  "audit_log",
  "newsletter_subscriptions",
];

async function counts(url: string): Promise<Record<string, number>> {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const result: Record<string, number> = {};
    for (const table of CHECK_TABLES) {
      const [row] = await client.unsafe<{ n: number }[]>(
        `select count(*)::int as n from "${table}"`,
      );
      result[table] = row?.n ?? 0;
    }
    return result;
  } finally {
    await client.end();
  }
}

/**
 * Restore test (AK-14): restores the latest backup into a temporary database, compares row
 * counts with the live database and drops the temporary database again.
 */
export async function runRestoreTest(
  db: DbExecutor,
  deps: BackupDeps,
  options: { key?: string; triggeredBy?: string } = {},
) {
  const key = options.key ?? (await latestBackupKey(deps.storage));
  const [runRow] = await db
    .insert(backupRuns)
    .values({ kind: "restore_test", storageKey: key, triggeredBy: options.triggeredBy ?? "manual" })
    .returning({ id: backupRuns.id });
  const source = new URL(deps.databaseUrl);
  const tempName = `${source.pathname.slice(1)}_restore_${Date.now()}`;
  const admin = new URL(source);
  admin.pathname = "/postgres";
  const target = new URL(source);
  target.pathname = `/${tempName}`;
  const adminClient = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    if (!key) throw new Error("Kein Backup vorhanden.");
    await adminClient.unsafe(`create database "${tempName}"`);
    await restoreBackup(deps, key, target.toString());
    const [restored, live] = await Promise.all([
      counts(target.toString()),
      counts(deps.databaseUrl),
    ]);
    const details = {
      tables: Object.fromEntries(
        CHECK_TABLES.map((t) => [t, { restored: restored[t], live: live[t] }]),
      ),
    };
    // Live data may have grown since the backup; restored data must never exceed it and must not be empty.
    const ok =
      CHECK_TABLES.every((t) => (restored[t] ?? 0) <= (live[t] ?? 0)) && (restored.users ?? 0) > 0;
    await db
      .update(backupRuns)
      .set({
        status: ok ? "succeeded" : "failed",
        details,
        finishedAt: new Date(),
        error: ok ? null : "Zeilenzahlen passen nicht",
      })
      .where(eq(backupRuns.id, runRow!.id));
    return { ok, key, details };
  } catch (error) {
    await db
      .update(backupRuns)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 1000) : "unknown",
        finishedAt: new Date(),
      })
      .where(eq(backupRuns.id, runRow!.id));
    throw error;
  } finally {
    await adminClient
      .unsafe(`drop database if exists "${tempName}" with (force)`)
      .catch(() => undefined);
    await adminClient.end();
  }
}

export async function listBackupRuns(db: DbExecutor, limit = 50) {
  return db.select().from(backupRuns).orderBy(desc(backupRuns.startedAt)).limit(limit);
}

/** Convenience for scripts outside the app (own short-lived connection). */
export function scriptDb(url: string) {
  const client = postgres(url, { max: 2, onnotice: () => {} });
  return {
    db: drizzle(client, { casing: "snake_case" }) as unknown as DbExecutor,
    close: () => client.end(),
  };
}
