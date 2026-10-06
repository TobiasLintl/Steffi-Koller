import { ActionForm } from "@/components/admin/action-form";
import { CouponFields } from "@/components/admin/coupon-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatMoney } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { isCouponActive } from "@/server/domain/catalog/schemas";
import { listCoupons } from "@/server/services/coupons";
import { listProductsWithMappings } from "@/server/services/products";
import { deleteCouponAction, saveCouponAction } from "./actions";

export const metadata = { title: "Gutscheine" };

export default async function CouponsPage() {
  await requirePermission("coupons:write", "/admin/gutscheine");
  const [rows, productRows] = await Promise.all([listCoupons(db), listProductsWithMappings(db)]);
  const products = productRows.map((r) => ({ id: r.product.id, title: r.product.title }));
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Gutscheine & Aktionen</h1>
        <p className="text-sm text-muted-foreground">
          Eingelöst werden Codes im Checkout des Resellers. Lege den Code dort mit denselben
          Bedingungen an – hier verwaltest du ihn und kannst ihn zeitlich begrenzt auf der Website
          ankündigen.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Neuer Gutschein</CardTitle>
        </CardHeader>
        <ActionForm
          action={saveCouponAction.bind(null, null)}
          submitLabel="Anlegen"
          className="max-w-3xl"
        >
          <CouponFields products={products} />
        </ActionForm>
      </Card>
      {rows.map((c) => (
        <Card key={c.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>
                <code>{c.code}</code>
              </CardTitle>
              {isCouponActive(c, now) ? (
                <Badge>aktiv</Badge>
              ) : (
                <Badge variant="muted">inaktiv</Badge>
              )}
              {c.showOnWebsite ? <Badge variant="outline">auf Website</Badge> : null}
            </div>
            <CardDescription>
              {c.discountType === "percent"
                ? `${c.discountValue} %`
                : formatMoney(c.discountValue, c.currency ?? "EUR")}{" "}
              · {c.validFrom ? `ab ${formatDateTime(c.validFrom)}` : "sofort"} ·{" "}
              {c.validUntil ? `bis ${formatDateTime(c.validUntil)}` : "unbefristet"}
            </CardDescription>
          </CardHeader>
          <details>
            <summary className="cursor-pointer text-sm">Bearbeiten</summary>
            <ActionForm
              action={saveCouponAction.bind(null, c.id)}
              submitLabel="Speichern"
              variant="outline"
              className="mt-3 max-w-3xl"
            >
              <CouponFields coupon={c} products={products} />
            </ActionForm>
          </details>
          <form action={deleteCouponAction.bind(null, c.id)}>
            <Button type="submit" variant="ghost" size="sm">
              Löschen
            </Button>
          </form>
        </Card>
      ))}
    </div>
  );
}
