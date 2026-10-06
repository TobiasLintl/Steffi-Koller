import { ActionForm } from "@/components/admin/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { listBackupRuns } from "@/server/backup/run";
import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { backupNowAction, restoreTestAction } from "./actions";

export const metadata = { title: "Backups" };

export default async function BackupsPage() {
  await requirePermission("backups:manage", "/admin/backups");
  const runs = await listBackupRuns(db);
  const env = serverEnv();
  const lastBackup = runs.find((r) => r.kind === "backup" && r.status === "succeeded");
  const lastTest = runs.find((r) => r.kind === "restore_test");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Backups</h1>
        <p className="text-sm text-muted-foreground">
          Jede Nacht um 02:30 Uhr wird die Datenbank verschlüsselt gesichert (
          {env.BACKUP_STORAGE_DRIVER === "s3"
            ? "externer Objektspeicher"
            : "lokales Verzeichnis – nur Entwicklung"}
          ), Aufbewahrung {env.BACKUP_RETENTION_DAYS} Tage. Sonntags läuft automatisch ein
          Restore-Test.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Letztes Backup</CardTitle>
            <CardDescription>
              {lastBackup ? formatDateTime(lastBackup.finishedAt) : "noch keins"}
            </CardDescription>
          </CardHeader>
          <ActionForm action={backupNowAction} submitLabel="Jetzt sichern" variant="outline" />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Letzter Restore-Test</CardTitle>
            <CardDescription>
              {lastTest
                ? `${formatDateTime(lastTest.finishedAt ?? lastTest.startedAt)} · ${lastTest.status === "succeeded" ? "erfolgreich" : "fehlgeschlagen"}`
                : "noch keiner"}
            </CardDescription>
          </CardHeader>
          <ActionForm
            action={restoreTestAction}
            submitLabel="Restore-Test starten"
            variant="outline"
          />
        </Card>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Start</TableHead>
            <TableHead>Art</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Datei</TableHead>
            <TableHead>Größe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(r.startedAt)}</TableCell>
              <TableCell>{r.kind === "backup" ? "Backup" : "Restore-Test"}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    r.status === "succeeded"
                      ? "default"
                      : r.status === "failed"
                        ? "destructive"
                        : "muted"
                  }
                >
                  {r.status === "succeeded" ? "ok" : r.status === "failed" ? "Fehler" : "läuft"}
                </Badge>
                {r.error ? <div className="mt-1 text-xs text-destructive">{r.error}</div> : null}
              </TableCell>
              <TableCell className="font-mono text-xs">{r.storageKey}</TableCell>
              <TableCell>{r.sizeBytes ? `${Math.round(r.sizeBytes / 1024)} KB` : "–"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
