import type { Metadata } from "next";

import { ActionForm } from "@/components/admin/action-form";
import { FormField } from "@/components/form-field";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isStaffRole } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { deleteOwnAccountAction } from "./actions";

export const metadata: Metadata = { title: "Meine Daten" };

export default async function MyDataPage() {
  const user = await requireUser("/konto/daten");
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Meine Daten</h1>
      <Card>
        <CardHeader>
          <CardTitle>Datenauskunft</CardTitle>
          <CardDescription>
            Lade alle Daten herunter, die wir zu dir gespeichert haben – Konto, Käufe, Kurszugänge,
            Lernfortschritt, Newsletter-Status und Supportverlauf (JSON-Datei).
          </CardDescription>
        </CardHeader>
        <div>
          <a href="/api/konto/datenauskunft" className={buttonVariants({ variant: "outline" })}>
            Meine Daten herunterladen
          </a>
        </div>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Konto löschen</CardTitle>
          <CardDescription>
            Deine persönlichen Daten werden gelöscht bzw. anonymisiert und deine Kurszugänge enden
            sofort. Kaufbelege müssen wir aus gesetzlichen Gründen bis zum Ende der
            Aufbewahrungsfrist (10 Jahre) aufbewahren; danach werden sie automatisch gelöscht.
          </CardDescription>
        </CardHeader>
        {isStaffRole(user.role) ? (
          <p className="text-sm text-muted-foreground">
            Mitarbeiterkonten werden über die Administration entfernt.
          </p>
        ) : (
          <ActionForm
            action={deleteOwnAccountAction}
            submitLabel="Konto endgültig löschen"
            variant="destructive"
            confirm="Konto wirklich endgültig löschen?"
          >
            <FormField
              id="confirmEmail"
              label={`Zur Bestätigung deine E-Mail-Adresse (${user.email})`}
            >
              <Input
                id="confirmEmail"
                name="confirmEmail"
                type="email"
                required
                autoComplete="off"
              />
            </FormField>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
