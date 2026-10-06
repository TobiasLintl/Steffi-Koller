import type { Metadata } from "next";

import { ProductCard } from "@/components/site/product-card";
import { db } from "@/server/db";
import { listFreeProducts, listPublicOffers } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Angebote",
  description: "Selbstlernkurse von Seelenzeit – Einmalkauf, kein Abo, in deinem Tempo.",
};

export default async function OffersPage() {
  const [offers, free] = await Promise.all([listPublicOffers(db), listFreeProducts(db)]);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Angebote</h1>
        <p className="max-w-2xl text-muted-foreground">
          Alle Kurse sind Einmalkäufe – ohne Abo und ohne automatische Verlängerung. Du lernst in
          deinem persönlichen Bereich, so lange dein Zugang läuft.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
      {free.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Kostenlos</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {free.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
