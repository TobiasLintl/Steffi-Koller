import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { selfReport } from "@/server/services/privacy";

/** DSGVO Art. 15 self-service: download of all own data as JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const report = await selfReport(db, user.id);
  if (!report) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(report, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="seelenzeit-meine-daten-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
