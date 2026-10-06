import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { countryName } from "@/lib/countries";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { searchCustomers } from "@/server/services/customers";

export const metadata = { title: "Kunden" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/kunden">) {
  await requirePermission("customers:read", "/admin/kunden");
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const customers = await searchCustomers(db, query);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Kunden</h1>
      <form className="flex max-w-lg gap-2" role="search">
        <Input
          name="q"
          defaultValue={query}
          placeholder="E-Mail, Name oder Firma"
          aria-label="Kunden suchen"
        />
        <Button type="submit">Suchen</Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>E-Mail</TableHead>
            <TableHead>Land</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Kurse</TableHead>
            <TableHead>Seit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Keine Kunden gefunden.
              </TableCell>
            </TableRow>
          ) : (
            customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/admin/kunden/${c.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {c.name}
                  </Link>
                  {c.companyName ? (
                    <div className="text-xs text-muted-foreground">{c.companyName}</div>
                  ) : null}
                </TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{countryName(c.country)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{c.customerType === "b2b" ? "B2B" : "B2C"}</Badge>
                </TableCell>
                <TableCell>{c.courseCount}</TableCell>
                <TableCell>{formatDate(c.createdAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
