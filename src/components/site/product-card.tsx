import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";

export interface ProductCardData {
  slug: string;
  title: string;
  subtitle: string;
  tier: string;
  kind: string;
  accessMonths: number | null;
  priceEurCents: number | null;
  priceChfCents: number | null;
}

export function priceLabel(
  p: Pick<ProductCardData, "priceEurCents" | "priceChfCents" | "tier">,
): string {
  if (p.tier === "free") return "Kostenlos";
  const parts = [
    p.priceEurCents !== null ? formatMoney(p.priceEurCents, "EUR") : null,
    p.priceChfCents !== null ? formatMoney(p.priceChfCents, "CHF") : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Preis auf Anfrage";
}

export function accessLabel(p: Pick<ProductCardData, "accessMonths" | "kind">): string {
  if (p.kind === "coaching") return "1:1-Begleitung";
  return p.accessMonths ? `${p.accessMonths} Monate Zugang` : "Unbegrenzter Zugang";
}

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link href={`/angebote/${product.slug}`} className="group block h-full">
      <Card className="h-full transition-colors group-hover:border-primary">
        <CardHeader>
          <CardTitle>{product.title}</CardTitle>
          {product.subtitle ? <CardDescription>{product.subtitle}</CardDescription> : null}
        </CardHeader>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{accessLabel(product)}</Badge>
          <span className="text-sm font-medium">{priceLabel(product)}</span>
        </div>
      </Card>
    </Link>
  );
}
