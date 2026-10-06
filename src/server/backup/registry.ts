import path from "node:path";

import {
  createLocalStorageAdapter,
  createS3StorageAdapter,
  type StorageAdapter,
} from "@/server/adapters/storage";
import type { ServerEnv } from "@/server/env";
import type { BackupDeps } from "./run";

/** Backups go to their own storage (separate bucket), never to the media bucket. */
export function backupStorage(env: ServerEnv): StorageAdapter {
  if (env.BACKUP_STORAGE_DRIVER === "s3") {
    if (
      !env.BACKUP_S3_ENDPOINT ||
      !env.BACKUP_S3_BUCKET ||
      !env.BACKUP_S3_ACCESS_KEY_ID ||
      !env.BACKUP_S3_SECRET_ACCESS_KEY
    ) {
      throw new Error("BACKUP_S3_* settings are incomplete");
    }
    return createS3StorageAdapter({
      endpoint: env.BACKUP_S3_ENDPOINT,
      region: env.BACKUP_S3_REGION,
      bucket: env.BACKUP_S3_BUCKET,
      accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID,
      secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY,
    });
  }
  return createLocalStorageAdapter({
    rootDir: path.resolve(env.BACKUP_DIR),
    baseUrl: "",
    signingSecret: "unused",
  });
}

export function backupDeps(env: ServerEnv): BackupDeps {
  if (!env.BACKUP_ENCRYPTION_KEY) throw new Error("BACKUP_ENCRYPTION_KEY is not set");
  return {
    storage: backupStorage(env),
    databaseUrl: env.DATABASE_URL,
    passphrase: env.BACKUP_ENCRYPTION_KEY,
    retentionDays: env.BACKUP_RETENTION_DAYS,
  };
}
