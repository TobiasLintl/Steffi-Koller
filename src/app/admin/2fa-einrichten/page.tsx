import { redirect } from "next/navigation";

import { TwoFactorSetup } from "@/components/account/two-factor-setup";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { isStaffRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Zwei-Faktor-Anmeldung einrichten" };

/** Mandatory TOTP enrolment for every staff role (CLAUDE.md §6). */
export default async function StaffTwoFactorPage() {
  const user = await requireUser("/admin");
  if (!isStaffRole(user.role)) redirect("/konto");
  if (user.twoFactorEnabled) redirect("/admin");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold">Zwei-Faktor-Anmeldung einrichten</h1>
          <CardDescription>
            Für den Adminbereich ist die Zwei-Faktor-Anmeldung Pflicht. Du brauchst dafür eine
            Authenticator-App auf deinem Handy.
          </CardDescription>
        </CardHeader>
        <TwoFactorSetup enabled={false} redirectTo="/admin" allowDisable={false} />
      </Card>
    </main>
  );
}
