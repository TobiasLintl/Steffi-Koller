import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RichText } from "@/components/rich-text";
import { FreeProductClaim } from "@/components/site/free-product-claim";
import { accessLabel, priceLabel } from "@/components/site/product-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/server/db";
import { getPublicProduct } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/angebote/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const row = await getPublicProduct(db, slug);
  if (!row) return {};
  return {
    title: row.product.title,
    description: row.product.subtitle || undefined,
    openGraph: {
      title: row.product.title,
      description: row.product.subtitle || undefined,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/angebote/[slug]">) {
  const { slug } = await params;
  const row = await getPublicProduct(db, slug);
  if (!row) notFound();
  const { product } = row;
  const free = product.tier === "free";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{accessLabel(product)}</Badge>
          {!free && product.kind !== "coaching" ? (
            <Badge variant="outline">Einmalkauf · kein Abo</Badge>
          ) : null}
        </div>
        <h1 className="text-3xl leading-tight font-semibold sm:text-4xl">{product.title}</h1>
        {product.subtitle ? (
          <p className="text-lg text-muted-foreground">{product.subtitle}</p>
        ) : null}
      </div>

      {product.description ? <RichText text={product.description} /> : null}

      <aside className="flex flex-col gap-4 rounded-2xl border bg-card p-6">
        <p className="text-2xl font-semibold">{priceLabel(product)}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {product.kind === "course_access" ? (
            <li>
              {product.accessMonths
                ? `Zugang für ${product.accessMonths} Monate ab Kauf`
                : "Unbegrenzter Zugang"}
            </li>
          ) : null}
          {!free ? (
            <li>Keine automatische Verlängerung – du entscheidest selbst, ob du verlängerst.</li>
          ) : null}
          {!free ? (
            <li>
              Kauf, Rechnung und Umsatzsteuer über unseren Vertriebspartner; Zahlung in EUR oder
              CHF.
            </li>
          ) : null}
          {!free ? (
            <li>Firmenkundin? Im Bestellformular kannst du Firma und USt-IdNr. angeben.</li>
          ) : null}
        </ul>
        {free ? (
          <FreeProductClaim productId={product.id} />
        ) : product.checkoutUrl ? (
          <div>
            <a href={product.checkoutUrl} className={buttonVariants({ size: "lg" })} rel="noopener">
              Jetzt kaufen
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Dieses Angebot ist bald verfügbar.</p>
        )}
      </aside>
    </main>
  );
}
