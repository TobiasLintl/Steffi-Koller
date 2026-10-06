import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Konto gelöscht", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold">Dein Konto wurde gelöscht</h1>
      <p className="text-muted-foreground">
        Danke für die gemeinsame Zeit. Wir wünschen dir alles Gute auf deinem Weg.
      </p>
      <Link href="/" className="underline underline-offset-4">
        Zur Startseite
      </Link>
    </main>
  );
}
