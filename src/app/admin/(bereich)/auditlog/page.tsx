import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { auditActors, distinctAuditActions, listAuditEntries } from "@/server/services/audit";

export const metadata = { title: "Auditlog" };

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const date = (v: unknown, endOfDay = false) => {
  const s = str(v);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  return new Date(`${s}T${endOfDay ? "23:59:59" : "00:00:00"}`);
};

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/auditlog">) {
  await requirePermission("audit:read", "/admin/auditlog");
  const sp = await searchParams;
  const page = Math.max(0, Number(str(sp.page) ?? 0) || 0);
  const filter = {
    action: str(sp.action),
    actorUserId: str(sp.actor),
    targetId: str(sp.target),
    from: date(sp.from),
    to: date(sp.to, true),
  };
  const [{ rows, hasMore }, actions, actors] = await Promise.all([
    listAuditEntries(db, filter, page),
    distinctAuditActions(db),
    auditActors(db),
  ]);
  const query = (p: number) =>
    `/admin/auditlog?${new URLSearchParams(Object.entries({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string")), page: String(p) }) as [string, string][])}`;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Auditlog</h1>
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select name="action" defaultValue={filter.action ?? ""} aria-label="Aktion">
          <option value="">Alle Aktionen</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select name="actor" defaultValue={filter.actorUserId ?? ""} aria-label="Person">
          <option value="">Alle Personen</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Input name="from" type="date" defaultValue={str(sp.from)} aria-label="Von" />
        <Input name="to" type="date" defaultValue={str(sp.to)} aria-label="Bis" />
        <div className="flex gap-2">
          <Input
            name="target"
            defaultValue={filter.targetId}
            placeholder="Ziel-ID"
            aria-label="Ziel-ID"
          />
          <Button type="submit" variant="outline">
            Filtern
          </Button>
        </div>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Zeitpunkt</TableHead>
            <TableHead>Aktion</TableHead>
            <TableHead>Wer</TableHead>
            <TableHead>Ziel</TableHead>
            <TableHead>Begründung / Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ entry, actorName }) => (
            <TableRow key={entry.id}>
              <TableCell className="whitespace-nowrap">
                {formatDateTime(entry.occurredAt)}
              </TableCell>
              <TableCell className="font-mono text-xs">{entry.action}</TableCell>
              <TableCell>
                {actorName ?? (entry.actorUserId ? entry.actorUserId.slice(0, 8) : "System")}
                {entry.actorRole ? (
                  <div className="text-xs text-muted-foreground">{entry.actorRole}</div>
                ) : null}
              </TableCell>
              <TableCell className="text-xs">
                {entry.targetType}
                {entry.targetId ? (
                  <div className="font-mono text-muted-foreground">{entry.targetId}</div>
                ) : null}
              </TableCell>
              <TableCell className="max-w-md text-xs">
                {entry.reason ? <div>„{entry.reason}“</div> : null}
                {entry.metadata ? (
                  <code className="break-all text-muted-foreground">
                    {JSON.stringify(entry.metadata)}
                  </code>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex gap-3">
        {page > 0 ? (
          <Link
            href={query(page - 1)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ← Neuere
          </Link>
        ) : null}
        {hasMore ? (
          <Link
            href={query(page + 1)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Ältere →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
