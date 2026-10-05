"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/server/auth/session";
import { backupDeps } from "@/server/backup/registry";
import { runBackup, runRestoreTest } from "@/server/backup/run";
import { db } from "@/server/db";
import { serverEnv } from "@/server/env";

export async function backupNowAction(): Promise<ActionState> {
  const actor = await requirePermission("backups:manage", "/admin/backups");
  try {
    const result = await runBackup(db, backupDeps(serverEnv()), { triggeredBy: actor.id });
    revalidatePath("/admin/backups");
    return { ok: true, message: `Backup erstellt (${Math.round(result.sizeBytes / 1024)} KB).` };
  } catch (error) {
    revalidatePath("/admin/backups");
    return {
      ok: false,
      message: `Backup fehlgeschlagen: ${error instanceof Error ? error.message : "unbekannt"}`,
    };
  }
}

export async function restoreTestAction(): Promise<ActionState> {
  const actor = await requirePermission("backups:manage", "/admin/backups");
  try {
    const result = await runRestoreTest(db, backupDeps(serverEnv()), { triggeredBy: actor.id });
    revalidatePath("/admin/backups");
    return result.ok
      ? { ok: true, message: "Restore-Test erfolgreich." }
      : { ok: false, message: "Restore-Test: Zeilenzahlen weichen ab." };
  } catch (error) {
    revalidatePath("/admin/backups");
    return {
      ok: false,
      message: `Restore-Test fehlgeschlagen: ${error instanceof Error ? error.message : "unbekannt"}`,
    };
  }
}
