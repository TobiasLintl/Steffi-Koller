import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { countryName } from "@/lib/countries";
import { formatDateTime, formatMoney } from "@/lib/format";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listOrders, type OrderFilter } from "@/server/services/orders";

export const metadata = { title: "Käufe" };

const STATUS_LABELS = {
  paid: "bezahlt",
  refunded: "erstattet",
  chargeback: "Rücklastschrift",
  cancelled: "storniert",
} as const;

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return allowed.find((a) => a === value);
}

export default async function OrdersPage({ searchParams }: PageProps<"/admin/kaeufe">) {
  const actor = await requirePermission("orders:read", "/admin/kaeufe");
  const sp = await searchParams;
  const filter: OrderFilter = {
    status: pick(sp.status, ["paid", "refunded", "chargeback", "cancelled"] as const),
    provider: pick(sp.provider, ["copecart", "digistore24"] as const),
    currency: pick(sp.currency, ["EUR", "CHF"] as const),
  };
  const rows = await listOrders(db, filter);
  const canOpenCustomer = hasPermission(actor.role, "customers:read");

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Käufe</h1>
      <form className="flex flex-wrap items-end gap-3">
        <Select
          name="status"
          defaultValue={filter.status ?? ""}
          aria-label="Status"
          className="w-44"
        >
          <option value="">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select
          name="provider"
          defaultValue={filter.provider ?? ""}
          aria-label="Reseller"
          className="w-44"
        >
          <option value="">Alle Reseller</option>
          <option value="copecart">CopeCart</option>
          <option value="digistore24">Digistore24</option>
        </Select>
        <Select
          name="currency"
          defaultValue={filter.currency ?? ""}
          aria-label="Währung"
          className="w-32"
        >
          <option value="">EUR + CHF</option>
          <option value="EUR">EUR</option>
          <option value="CHF">CHF</option>
        </Select>
        <Button type="submit" variant="outline">
          Filtern
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Produkt</TableHead>
            <TableHead>Betrag</TableHead>
            <TableHead>Land</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Beleg</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Kunde</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground">
                Keine Käufe gefunden.
              </TableCell>
            </TableRow>
          ) : (
            rows.map(({ order, productTitle, customerName }) => (
              <TableRow key={order.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(order.purchasedAt)}
                </TableCell>
                <TableCell>
                  {productTitle ?? order.providerProductId}
                  {order.isTest ? (
                    <Badge variant="muted" className="ml-2">
                      Test
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatMoney(order.amountMinor, order.currency ?? "EUR")}
                </TableCell>
                <TableCell>{countryName(order.buyerCountry)}</TableCell>
                <TableCell>
                  {order.customerType === "b2b" ? (
                    <span title={order.vatId ?? undefined}>B2B · {order.companyName}</span>
                  ) : (
                    "B2C"
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {order.provider} {order.receiptReference}
                </TableCell>
                <TableCell>
                  <Badge variant={order.status === "paid" ? "default" : "destructive"}>
                    {STATUS_LABELS[order.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {order.userId && canOpenCustomer ? (
                    <Link
                      href={`/admin/kunden/${order.userId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {customerName}
                    </Link>
                  ) : (
                    (customerName ?? "–")
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
