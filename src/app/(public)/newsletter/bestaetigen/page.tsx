import type { Metadata } from "next";

import { TokenAction } from "@/components/site/token-action";
import { Alert } from "@/components/ui/alert";
import { confirmNewsletterAction } from "../actions";

export const metadata: Metadata = {
  title: "Newsletter-Anmeldung bestätigen",
  robots: { index: false },
};

export default async function Page({ searchParams }: PageProps<"/newsletter/bestaetigen">) {
  const { token } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Newsletter-Anmeldung bestätigen</h1>
      {typeof token === "string" && token.length > 10 ? (
        <>
          <p className="text-muted-foreground">
            Bitte bestätige mit einem Klick, dass du den Seelenzeit-Newsletter erhalten möchtest.
          </p>
          <TokenAction
            action={confirmNewsletterAction.bind(null, token)}
            label="Anmeldung bestätigen"
          />
        </>
      ) : (
        <Alert variant="destructive">Dieser Link ist unvollständig.</Alert>
      )}
    </main>
  );
}
