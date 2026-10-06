import type { products } from "@/server/db/schema";

type Product = typeof products.$inferSelect;

/** DB row → form strings (prices back to major units). */
export function productToFormValues(p: Product | undefined) {
  const money = (v: number | null | undefined) =>
    v === null || v === undefined ? "" : (v / 100).toFixed(2).replace(".", ",");
  return {
    slug: p?.slug ?? "",
    title: p?.title ?? "",
    subtitle: p?.subtitle ?? "",
    description: p?.description ?? "",
    tier: p?.tier ?? "small",
    kind: p?.kind ?? "course_access",
    courseId: p?.courseId ?? "",
    accessMonths: p ? String(p.accessMonths ?? "") : "6",
    extensionMonths: p ? String(p.extensionMonths ?? "") : "3",
    priceEur: money(p?.priceEurCents),
    priceChf: money(p?.priceChfCents),
    checkoutUrl: p?.checkoutUrl ?? "",
    isPublished: p?.isPublished ?? false,
    sortOrder: String(p?.sortOrder ?? 0),
  };
}
