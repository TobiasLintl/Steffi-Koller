import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { TIER_LABELS } from "@/server/domain/access";
import { listProductsWithMappings } from "@/server/services/products";

export const metadata = { title: "Produkte" };

const KIND_LABELS = {
  course_access: "Kurszugang",
  extension: "Verlängerung",
  coaching: "Coaching",
};

export default async function ProductsPage() {
  await requirePermission("products:write", "/admin/produkte");
  const rows = await listProductsWithMappings(db);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Produkte & Preise</h1>
        <Link href="/admin/produkte/neu" className={buttonVariants()}>
          Neues Produkt
        </Link>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produkt</TableHead>
            <TableHead>Art</TableHead>
            <TableHead>Dauer</TableHead>
            <TableHead>Preis</TableHead>
            <TableHead>Reseller</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ product, courseTitle, mappings }) => (
            <TableRow key={product.id}>
              <TableCell>
                <Link
                  href={`/admin/produkte/${product.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {product.title}
                </Link>
                {courseTitle ? (
                  <div className="text-xs text-muted-foreground">{courseTitle}</div>
                ) : null}
              </TableCell>
              <TableCell>
                {KIND_LABELS[product.kind]} · {TIER_LABELS[product.tier]}
              </TableCell>
              <TableCell>
                {product.kind === "extension"
                  ? `+${product.extensionMonths} Mon.`
                  : product.accessMonths
                    ? `${product.accessMonths} Mon.`
                    : "unbegrenzt"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatMoney(product.priceEurCents, "EUR")} /{" "}
                {formatMoney(product.priceChfCents, "CHF")}
              </TableCell>
              <TableCell>
                {mappings.length ? (
                  mappings.map((m) => `${m.provider}: ${m.providerProductId}`).join(", ")
                ) : product.tier === "free" ? (
                  "–"
                ) : (
                  <Badge variant="destructive">keine Zuordnung</Badge>
                )}
              </TableCell>
              <TableCell>
                {product.isPublished ? (
                  <Badge>veröffentlicht</Badge>
                ) : (
                  <Badge variant="muted">Entwurf</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
