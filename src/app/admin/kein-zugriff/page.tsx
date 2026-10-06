import Link from "next/link";

import { requireStaff } from "@/server/auth/session";

export const metadata = { title: "Kein Zugriff" };

export default async function NoAccessPage() {
  await requireStaff();
  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold">Kein Zugriff</h1>
      <p className="text-muted-foreground">
        Für diesen Bereich hat deine Rolle keine Berechtigung. Wenn du ihn brauchst, wende dich
        bitte an die Administration.
      </p>
      <Link href="/admin" className="underline underline-offset-4">
        Zur Übersicht
      </Link>
    </main>
  );
}
