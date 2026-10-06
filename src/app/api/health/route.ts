import { sql } from "drizzle-orm";

import { db } from "@/server/db";

/** Liveness/readiness for Docker and uptime monitoring. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json(
      { status: "ok", db: "ok", time: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "error", db: "unreachable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
