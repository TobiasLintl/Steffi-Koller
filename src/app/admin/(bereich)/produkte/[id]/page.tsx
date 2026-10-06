import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ActionForm } from "@/components/admin/action-form";
import { ProductForm } from "@/components/admin/product-form";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PAYMENT_PROVIDERS } from "@/server/adapters/payment";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { PROVIDER_LABELS } from "@/server/payment/registry";
import { listCoursesForSelect } from "@/server/services/customers";
import { productToFormValues } from "@/server/services/product-form";
import { getProduct, listProductsWithMappings } from "@/server/services/products";
import {
  addMappingAction,
  deleteProductAction,
  removeMappingAction,
  updateProductAction,
} from "../actions";

export const metadata = { title: "Produkt bearbeiten" };

export default async function EditProductPage({ params }: PageProps<"/admin/produkte/[id]">) {
  const { id } = await params;
  await requirePermission("products:write", `/admin/produkte/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const product = await getProduct(db, id);
  if (!product) notFound();
  const [courses, all] = await Promise.all([
    listCoursesForSelect(db),
    listProductsWithMappings(db),
  ]);
  const mappings = all.find((r) => r.product.id === id)?.mappings ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/produkte" className="text-sm text-muted-foreground hover:underline">
          ← Produkte
        </Link>
        <h1 className="text-2xl font-semibold">{product.title}</h1>
        {product.isPublished && product.kind !== "extension" ? (
          <Link
            href={`/angebote/${product.slug}`}
            className="text-sm underline underline-offset-4"
            target="_blank"
          >
            Produktseite ansehen
          </Link>
        ) : null}
      </div>

      <Card>
        <ProductForm
          action={updateProductAction.bind(null, id)}
          values={productToFormValues(product)}
          courses={courses}
          submitLabel="Speichern"
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reseller-Zuordnung</CardTitle>
          <CardDescription>
            Nur Käufe mit zugeordneter Produkt-ID schalten automatisch frei.
          </CardDescription>
        </CardHeader>
        <ul className="flex flex-col gap-1">
          {mappings.map((m) => (
            <li key={m.id} className="flex items-center gap-3 text-sm">
              <span>
                {PROVIDER_LABELS[m.provider as keyof typeof PROVIDER_LABELS] ?? m.provider}:{" "}
                <code className="rounded bg-muted px-1">{m.providerProductId}</code>
              </span>
              <form action={removeMappingAction.bind(null, m.id)}>
                <Button type="submit" variant="ghost" size="sm">
                  Entfernen
                </Button>
              </form>
            </li>
          ))}
        </ul>
        <ActionForm
          action={addMappingAction}
          submitLabel="Zuordnung hinzufügen"
          variant="outline"
          className="max-w-xl"
        >
          <input type="hidden" name="productId" value={product.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="provider" label="Reseller">
              <Select id="provider" name="provider" defaultValue="copecart">
                {PAYMENT_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="providerProductId" label="Produkt-ID beim Reseller">
              <Input id="providerProductId" name="providerProductId" required />
            </FormField>
          </div>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produkt löschen</CardTitle>
          <CardDescription>
            Nur möglich, solange es keine Käufe gibt. Sonst bitte „nicht veröffentlicht“ setzen.
          </CardDescription>
        </CardHeader>
        <ActionForm
          action={deleteProductAction.bind(null, id)}
          submitLabel="Löschen"
          variant="destructive"
          confirm="Produkt wirklich löschen?"
        />
      </Card>
    </div>
  );
}
