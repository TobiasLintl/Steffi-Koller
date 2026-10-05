import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { dashboardMetrics, periodStart } from "@/server/services/metrics";

export const metadata = { title: "Kennzahlen" };

const PERIODS = [
  ["30", "30 Tage"],
  ["90", "90 Tage"],
  ["365", "12 Monate"],
  ["all", "Gesamt"],
] as const;

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

export default async function MetricsPage({ searchParams }: PageProps<"/admin/kennzahlen">) {
  await requirePermission("dashboard:view", "/admin/kennzahlen");
  const { zeitraum } = await searchParams;
  const period = PERIODS.find(([k]) => k === zeitraum)?.[0] ?? "30";
  const since = period === "all" ? null : periodStart(Number(period));
  const m = await dashboardMetrics(db, since);
  const leads = m.registrations + m.newsletterConfirmed;
  const conversion = leads ? `${Math.round((m.purchases / leads) * 100)} %` : "–";
  const maxRevenue = Math.max(1, ...m.revenueByProduct.map((r) => r.amountMinor));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Kennzahlen</h1>
        <nav className="flex gap-3 text-sm" aria-label="Zeitraum">
          {PERIODS.map(([k, label]) => (
            <Link
              key={k}
              href={`/admin/kennzahlen?zeitraum=${k}`}
              className={k === period ? "font-semibold underline" : "hover:underline"}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="text-sm text-muted-foreground">
        Eigene Zahlen ohne Werbetracking. Testkäufe sind ausgeschlossen.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Leads"
          value={leads}
          hint={`${m.registrations} Registrierungen · ${m.newsletterConfirmed} Newsletter (DOI)`}
        />
        <Stat label="Käufe" value={m.purchases} hint={`Conversion Lead → Kauf: ${conversion}`} />
        <Stat
          label="Umsatz (brutto)"
          value={
            m.revenue.length
              ? m.revenue.map((r) => formatMoney(r.amountMinor, r.currency)).join(" · ")
              : formatMoney(0, "EUR")
          }
        />
        <Stat
          label="Rückerstattungen"
          value={m.refunds}
          hint={
            m.refundedMinor.map((r) => formatMoney(r.amountMinor, r.currency)).join(" · ") ||
            undefined
          }
        />
        <Stat label="Verlängerungen" value={m.extensions} />
        <Stat label="Kostenlose Angebote" value={m.freeClaims} />
        <Stat
          label="Kursstarts"
          value={m.courseStarts}
          hint="Personen, die eine Lektion geöffnet haben"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Umsatz je Produkt</CardTitle>
        </CardHeader>
        {m.revenueByProduct.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Käufe in diesem Zeitraum.</p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {m.revenueByProduct.map((r) => (
            <li key={`${r.productId}-${r.currency}`} className="flex flex-col gap-1">
              <div className="flex justify-between gap-3 text-sm">
                <span>{r.title}</span>
                <span className="tabular-nums">
                  {r.count}× · {formatMoney(r.amountMinor, r.currency)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.round((r.amountMinor / maxRevenue) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fortschritt je Kurs</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kurs</TableHead>
              <TableHead>Zugänge</TableHead>
              <TableHead>Gestartet</TableHead>
              <TableHead>Ø erledigt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {m.progressByCourse.map((c) => (
              <TableRow key={c.courseId}>
                <TableCell>{c.title}</TableCell>
                <TableCell>{c.learners}</TableCell>
                <TableCell>{c.started}</TableCell>
                <TableCell>{Math.round(c.avgCompletion * 100)} %</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
