import type { Metadata } from "next";

import { TokenAction } from "@/components/site/token-action";
import { Alert } from "@/components/ui/alert";
import { unsubscribeNewsletterAction } from "../actions";

export const metadata: Metadata = { title: "Newsletter abbestellen", robots: { index: false } };

export default async function Page({ searchParams }: PageProps<"/newsletter/abmelden">) {
  const { token } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Newsletter abbestellen</h1>
      {typeof token === "string" && token.length > 10 ? (
        <>
          <p className="text-muted-foreground">
            Schade, dass du gehst. Mit einem Klick meldest du dich vom Newsletter ab.
          </p>
          <TokenAction action={unsubscribeNewsletterAction.bind(null, token)} label="Abmelden" />
        </>
      ) : (
        <Alert variant="destructive">Dieser Link ist unvollständig.</Alert>
      )}
    </main>
  );
}
