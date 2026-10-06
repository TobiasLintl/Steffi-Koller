import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ActionForm } from "@/components/admin/action-form";
import { WebhookStatusBadge } from "@/components/admin/webhook-status-badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { reprocessAction } from "../actions";

export default async function WebhookDetailPage({ params }: PageProps<"/admin/webhooks/[id]">) {
  const { id } = await params;
  await requirePermission("webhooks:read", `/admin/webhooks/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const [event] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, id));
  if (!event) notFound();

  let pretty = event.rawBody;
  try {
    pretty = JSON.stringify(JSON.parse(event.rawBody), null, 2);
  } catch {
    pretty = event.rawBody.replaceAll("&", "\n");
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/webhooks" className="text-sm text-muted-foreground hover:underline">
        ← Webhooks
      </Link>
      <h1 className="text-2xl font-semibold">
        {event.provider} · {event.providerEventType}
      </h1>
      <Card>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <WebhookStatusBadge status={event.status} />
          </dd>
          <dt className="text-muted-foreground">Transaktion</dt>
          <dd className="font-mono">{event.transactionId}</dd>
          <dt className="text-muted-foreground">Eingang</dt>
          <dd>{formatDateTime(event.receivedAt)}</dd>
          <dt className="text-muted-foreground">Verarbeitet</dt>
          <dd>{formatDateTime(event.processedAt)}</dd>
          <dt className="text-muted-foreground">Versuche</dt>
          <dd>{event.attempts}</dd>
          {event.error ? (
            <>
              <dt className="text-muted-foreground">Fehler</dt>
              <dd className="text-destructive">{event.error}</dd>
            </>
          ) : null}
        </dl>
        {event.status === "failed" ? (
          <ActionForm
            action={reprocessAction.bind(null, event.id)}
            submitLabel="Erneut verarbeiten"
          />
        ) : null}
      </Card>
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Rohdaten (enthält personenbezogene Daten)
        </summary>
        <pre className="mt-2 max-h-[60vh] overflow-auto rounded-lg bg-muted p-4 text-xs">
          {pretty}
        </pre>
      </details>
    </div>
  );
}
