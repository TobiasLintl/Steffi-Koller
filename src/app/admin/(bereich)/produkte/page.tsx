import { ActionForm } from "@/components/admin/action-form";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { PAYMENT_PROVIDERS } from "@/server/adapters/payment";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { TIER_LABELS } from "@/server/domain/access";
import { PROVIDER_LABELS } from "@/server/payment/registry";
import { listProductsWithMappings } from "@/server/services/products";
import { addMappingAction, removeMappingAction } from "./actions";

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Produkte</h1>
        <p className="text-sm text-muted-foreground">
          Ordne jedem Produkt die Produkt-ID beim Reseller zu. Nur zugeordnete Käufe schalten
          automatisch frei.
        </p>
      </div>
      <ul className="flex flex-col gap-4">
        {rows.map(({ product, courseTitle, mappings }) => (
          <li key={product.id}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{product.title}</CardTitle>
                  <Badge variant="outline">{TIER_LABELS[product.tier]}</Badge>
                  <Badge variant="secondary">{KIND_LABELS[product.kind]}</Badge>
                  {!product.isPublished ? (
                    <Badge variant="muted">nicht veröffentlicht</Badge>
                  ) : null}
                </div>
                <CardDescription>
                  {courseTitle ? `Kurs: ${courseTitle} · ` : ""}
                  {product.kind === "extension"
                    ? `+${product.extensionMonths ?? "?"} Monate`
                    : product.accessMonths
                      ? `${product.accessMonths} Monate Zugang`
                      : "unbegrenzter Zugang"}{" "}
                  · {formatMoney(product.priceEurCents, "EUR")} /{" "}
                  {formatMoney(product.priceChfCents, "CHF")}
                </CardDescription>
              </CardHeader>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Reseller-Zuordnungen</p>
                {mappings.length === 0 ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Noch keine Zuordnung – Käufe werden nicht freigeschaltet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {mappings.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 text-sm">
                        <span>
                          {PROVIDER_LABELS[m.provider as keyof typeof PROVIDER_LABELS] ??
                            m.provider}
                          : <code className="rounded bg-muted px-1">{m.providerProductId}</code>
                        </span>
                        <form action={removeMappingAction.bind(null, m.id)}>
                          <Button type="submit" variant="ghost" size="sm">
                            Entfernen
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <ActionForm
                  action={addMappingAction}
                  submitLabel="Zuordnung hinzufügen"
                  variant="outline"
                  className="mt-2 max-w-xl"
                >
                  <input type="hidden" name="productId" value={product.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField id={`provider-${product.id}`} label="Reseller">
                      <Select id={`provider-${product.id}`} name="provider" defaultValue="copecart">
                        {PAYMENT_PROVIDERS.map((p) => (
                          <option key={p} value={p}>
                            {PROVIDER_LABELS[p]}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField id={`pid-${product.id}`} label="Produkt-ID beim Reseller">
                      <Input id={`pid-${product.id}`} name="providerProductId" required />
                    </FormField>
                  </div>
                </ActionForm>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
