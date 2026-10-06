import { revalidatePath } from "next/cache";
import Link from "next/link";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listContactMessages, markContactMessage } from "@/server/services/contact";

export const metadata = { title: "Nachrichten" };

async function setStatus(id: string, status: "open" | "done") {
  "use server";
  const actor = await requirePermission("support:write", "/admin/nachrichten");
  await markContactMessage(db, z.uuid().parse(id), status, actor.id);
  revalidatePath("/admin/nachrichten");
}

export default async function MessagesPage({ searchParams }: PageProps<"/admin/nachrichten">) {
  const actor = await requirePermission("support:write", "/admin/nachrichten");
  const { status } = await searchParams;
  const filter = status === "done" ? "done" : status === "all" ? undefined : "open";
  const messages = await listContactMessages(db, filter);
  const canOpenCustomer = hasPermission(actor.role, "customers:read");

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Nachrichten</h1>
      <nav className="flex gap-4 text-sm" aria-label="Filter">
        <Link
          href="/admin/nachrichten"
          className={filter === "open" ? "font-semibold underline" : "hover:underline"}
        >
          Offen
        </Link>
        <Link
          href="/admin/nachrichten?status=done"
          className={filter === "done" ? "font-semibold underline" : "hover:underline"}
        >
          Erledigt
        </Link>
        <Link
          href="/admin/nachrichten?status=all"
          className={!filter ? "font-semibold underline" : "hover:underline"}
        >
          Alle
        </Link>
      </nav>
      {messages.length === 0 ? <p className="text-muted-foreground">Keine Nachrichten.</p> : null}
      <ul className="flex flex-col gap-4">
        {messages.map((m) => (
          <li key={m.id} id={m.id}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{m.subject}</p>
                <Badge variant={m.status === "open" ? "default" : "muted"}>
                  {m.status === "open" ? "offen" : "erledigt"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {m.name} ·{" "}
                <a href={`mailto:${m.email}`} className="underline">
                  {m.email}
                </a>{" "}
                · {formatDateTime(m.createdAt)}
                {m.userId && canOpenCustomer ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link href={`/admin/kunden/${m.userId}`} className="underline">
                      Kundenakte
                    </Link>
                  </>
                ) : null}
              </p>
              <p className="text-sm whitespace-pre-line">{m.message}</p>
              <form action={setStatus.bind(null, m.id, m.status === "open" ? "done" : "open")}>
                <Button type="submit" variant="outline" size="sm">
                  {m.status === "open" ? "Als erledigt markieren" : "Wieder öffnen"}
                </Button>
              </form>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
