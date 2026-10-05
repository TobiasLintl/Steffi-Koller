import type { Metadata } from "next";

import { RichText } from "@/components/rich-text";
import { db } from "@/server/db";
import { listFaq } from "@/server/services/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Häufige Fragen",
  description: "Antworten rund um Kurse, Zugang und Kauf bei Seelenzeit.",
};

export default async function FaqPage() {
  const items = await listFaq(db, { publishedOnly: true });
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold">Häufige Fragen</h1>
      {items.length === 0 ? (
        <p className="text-muted-foreground">Hier entstehen gerade die häufigsten Fragen.</p>
      ) : null}
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <details key={item.id} className="rounded-lg border bg-card p-4">
            <summary className="cursor-pointer font-medium">{item.question}</summary>
            <div className="mt-3 text-muted-foreground">
              <RichText text={item.answer} />
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
