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
import { db } from "@/server/db";
import { listSubscriptions, newsletterStats } from "@/server/services/newsletter";

export const metadata = { title: "Newsletter" };

const LABELS = {
  pending: "unbestätigt",
  confirmed: "bestätigt",
  unsubscribed: "abgemeldet",
} as const;

export default async function NewsletterAdminPage() {
  await requirePermission("newsletter:read", "/admin/newsletter");
  const [stats, rows] = await Promise.all([newsletterStats(db), listSubscriptions(db)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Newsletter</h1>
        <p className="text-sm text-muted-foreground">
          Nur bestätigte Kontakte (Double-Opt-in) werden an den Newsletter-Dienst übertragen. Der
          Versand selbst erfolgt im Newsletter-Dienst.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {(["confirmed", "pending", "unsubscribed"] as const).map((s) => (
          <Card key={s}>
            <CardHeader>
              <CardDescription>{LABELS[s]}</CardDescription>
              <CardTitle className="text-3xl">{stats[s] ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>E-Mail</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Angemeldet</TableHead>
            <TableHead>Bestätigt (DOI)</TableHead>
            <TableHead>Text-Version</TableHead>
            <TableHead>Quelle</TableHead>
            <TableHead>Sync</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.email}</TableCell>
              <TableCell>
                <Badge variant={r.status === "confirmed" ? "default" : "muted"}>
                  {LABELS[r.status]}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">{formatDateTime(r.subscribedAt)}</TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDateTime(r.confirmedAt)}
                {r.confirmIpTruncated ? (
                  <div className="text-xs text-muted-foreground">IP {r.confirmIpTruncated}</div>
                ) : null}
              </TableCell>
              <TableCell>{r.consentTextVersion}</TableCell>
              <TableCell>{r.source}</TableCell>
              <TableCell className="text-xs">
                {r.syncError ? (
                  <span className="text-destructive">{r.syncError}</span>
                ) : r.syncedAt ? (
                  "✓"
                ) : (
                  "–"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
