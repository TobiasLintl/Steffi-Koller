import type { Metadata } from "next";

import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Meine Kurse" };

export default async function MyCoursesPage() {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Hallo {user.name}!</h1>
      <p className="text-muted-foreground">Hier findest du bald deine Kurse.</p>
    </div>
  );
}
