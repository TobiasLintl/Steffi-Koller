import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { TwoFactorSetup } from "@/components/account/two-factor-setup";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isStaffRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";

export const metadata: Metadata = { title: "Sicherheit" };

export default async function SecurityPage() {
  const user = await requireUser("/konto/sicherheit");
  const [credential] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Sicherheit</h1>

      {credential ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Passwort ändern</CardTitle>
            </CardHeader>
            <ChangePasswordForm />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Zwei-Faktor-Anmeldung</CardTitle>
              <CardDescription>
                Zusätzlicher Schutz: Bei der Anmeldung gibst du neben deinem Passwort einen Code aus
                einer Authenticator-App ein.
              </CardDescription>
            </CardHeader>
            <TwoFactorSetup
              enabled={user.twoFactorEnabled}
              allowDisable={!isStaffRole(user.role)}
            />
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Passwort festlegen</CardTitle>
            <CardDescription>
              Du meldest dich bisher mit einem Anmeldelink an. Wenn du lieber ein Passwort nutzen
              möchtest, kannst du dir eines festlegen.
            </CardDescription>
          </CardHeader>
          <div>
            <Link href="/passwort-vergessen" className="underline underline-offset-4">
              Link zum Festlegen anfordern
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
