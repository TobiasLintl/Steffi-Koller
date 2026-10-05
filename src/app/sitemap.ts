import type { MetadataRoute } from "next";

import { db } from "@/server/db";
import { listFreeProducts, listPublicOffers } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.seelenzeit.de";
  const staticPaths = [
    "",
    "/angebote",
    "/ueber-mich",
    "/gratis",
    "/faq",
    "/kontakt",
    "/newsletter",
    "/impressum",
    "/datenschutz",
    "/agb",
    "/widerruf",
  ];
  const products = [...(await listPublicOffers(db)), ...(await listFreeProducts(db))];
  return [
    ...staticPaths.map((p) => ({
      url: `${base}${p}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : 0.6,
    })),
    ...products.map((p) => ({
      url: `${base}/angebote/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
