import { and, desc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { backupRuns } from "@/server/db/schema";

const MAX_AGE_HOURS = 36;

/**
 * Backup success control for external monitoring: 200 while the last successful backup is
 * younger than 36 hours, otherwise 503 (alerts the operator).
 */
export async function GET() {
  const [last] = await db
    .select({ finishedAt: backupRuns.finishedAt })
    .from(backupRuns)
    .where(and(eq(backupRuns.kind, "backup"), eq(backupRuns.status, "succeeded")))
    .orderBy(desc(backupRuns.finishedAt))
    .limit(1);
  const ageHours = last?.finishedAt ? (Date.now() - last.finishedAt.getTime()) / 3_600_000 : null;
  const ok = ageHours !== null && ageHours <= MAX_AGE_HOURS;
  return Response.json(
    {
      status: ok ? "ok" : "stale",
      lastBackupAt: last?.finishedAt ?? null,
      ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
