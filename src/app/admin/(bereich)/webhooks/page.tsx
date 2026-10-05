import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { WebhookStatusBadge } from "@/components/admin/webhook-status-badge";
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
import { webhookEvents } from "@/server/db/schema";

export const metadata = { title: "Webhooks" };

const STATUSES = ["received", "processed", "ignored", "failed"] as const;

export default async function WebhooksPage({ searchParams }: PageProps<"/admin/webhooks">) {
  await requirePermission("webhooks:read", "/admin/webhooks");
  const { status } = await searchParams;
  const filter = STATUSES.find((s) => s === status);
  const rows = await db
    .select({
      id: webhookEvents.id,
      provider: webhookEvents.provider,
      providerEventType: webhookEvents.providerEventType,
      transactionId: webhookEvents.transactionId,
      status: webhookEvents.status,
      error: webhookEvents.error,
      attempts: webhookEvents.attempts,
      receivedAt: webhookEvents.receivedAt,
    })
    .from(webhookEvents)
    .where(filter ? eq(webhookEvents.status, filter) : undefined)
    .orderBy(desc(webhookEvents.receivedAt))
    .limit(200);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Webhooks</h1>
      <nav className="flex flex-wrap gap-3 text-sm" aria-label="Filter">
        <Link
          href="/admin/webhooks"
          className={!filter ? "font-semibold underline" : "hover:underline"}
        >
          Alle
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/webhooks?status=${s}`}
            className={filter === s ? "font-semibold underline" : "hover:underline"}
          >
            <WebhookStatusBadge status={s} />
          </Link>
        ))}
      </nav>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Eingang</TableHead>
            <TableHead>Reseller</TableHead>
            <TableHead>Ereignis</TableHead>
            <TableHead>Transaktion</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link
                  href={`/admin/webhooks/${r.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {formatDateTime(r.receivedAt)}
                </Link>
              </TableCell>
              <TableCell>{r.provider}</TableCell>
              <TableCell>{r.providerEventType}</TableCell>
              <TableCell className="font-mono text-xs">{r.transactionId}</TableCell>
              <TableCell>
                <WebhookStatusBadge status={r.status} />
                {r.error ? <div className="mt-1 text-xs text-destructive">{r.error}</div> : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
