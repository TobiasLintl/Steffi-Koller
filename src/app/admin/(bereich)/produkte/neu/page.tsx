import Link from "next/link";

import { ProductForm } from "@/components/admin/product-form";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listCoursesForSelect } from "@/server/services/customers";
import { productToFormValues } from "@/server/services/product-form";
import { createProductAction } from "../actions";

export const metadata = { title: "Neues Produkt" };

export default async function NewProductPage() {
  await requirePermission("products:write", "/admin/produkte/neu");
  const courses = await listCoursesForSelect(db);
  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/produkte" className="text-sm text-muted-foreground hover:underline">
        ← Produkte
      </Link>
      <h1 className="text-2xl font-semibold">Neues Produkt</h1>
      <ProductForm
        action={createProductAction}
        values={productToFormValues(undefined)}
        courses={courses}
        submitLabel="Anlegen"
      />
    </div>
  );
}
