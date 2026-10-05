import { writeAudit } from "@/server/audit/log";
import { staffWithPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { toCsv } from "@/server/domain/export/csv";
import { EXPORT_DATASETS, exportDataset, isExportDataset } from "@/server/services/exports";

/** CSV/JSON export (ARC-03, AK-13). Every export is written to the audit log. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const dataset = url.searchParams.get("dataset") ?? "";
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  if (!isExportDataset(dataset)) return new Response("Unknown dataset", { status: 400 });
  const actor = await staffWithPermission(EXPORT_DATASETS[dataset].permission);
  if (!actor) return new Response("Forbidden", { status: 403 });

  const rows = await exportDataset(db, dataset);
  await writeAudit(db, {
    action: "export.created",
    actorUserId: actor.id,
    actorRole: actor.role,
    targetType: "export",
    targetId: dataset,
    metadata: { format, rows: rows.length },
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const body =
    format === "json"
      ? JSON.stringify({ dataset, exportedAt: new Date().toISOString(), rows }, null, 2)
      : toCsv(rows);
  return new Response(body, {
    headers: {
      "content-type":
        format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="seelenzeit-${dataset}-${stamp}.${format}"`,
      "cache-control": "private, no-store",
    },
  });
}
