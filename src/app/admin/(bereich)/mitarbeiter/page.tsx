import { ActionForm } from "@/components/admin/action-form";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { isRole, ROLE_LABELS, STAFF_ROLES } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listStaff } from "@/server/services/staff";
import { changeRoleAction, inviteStaffAction } from "./actions";

export const metadata = { title: "Mitarbeiter" };

const ROLE_HINTS: Record<(typeof STAFF_ROLES)[number], string> = {
  admin: "alles",
  support: "Stammdaten, Zugänge, Support – keine Fragebogeninhalte",
  editor: "Kurse, Lektionen, Medien, Seiten – keine Zahlungs-/Fragebogendaten",
  accounting: "Käufe, Belegreferenzen, Export – keine Kurs-/Fragebogeninhalte",
  report_approver: "nur Fragebogen-/Berichtsfreigabe",
};

export default async function StaffPage() {
  const actor = await requirePermission("staff:manage", "/admin/mitarbeiter");
  const staff = await listStaff(db);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Mitarbeiter</h1>

      <Card>
        <CardHeader>
          <CardTitle>Einladen</CardTitle>
          <CardDescription>
            Die Person erhält einen Link zum Festlegen ihres Passworts. Beim ersten Öffnen des
            Adminbereichs richtet sie die Zwei-Faktor-Anmeldung ein (Pflicht).
          </CardDescription>
        </CardHeader>
        <ActionForm action={inviteStaffAction} submitLabel="Einladung senden" className="max-w-2xl">
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField id="inv-name" label="Name">
              <Input id="inv-name" name="name" required />
            </FormField>
            <FormField id="inv-email" label="E-Mail-Adresse">
              <Input id="inv-email" name="email" type="email" required />
            </FormField>
            <FormField id="inv-role" label="Rolle">
              <Select id="inv-role" name="role" defaultValue="support">
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </ActionForm>
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {STAFF_ROLES.map((r) => (
            <li key={r}>
              <strong>{ROLE_LABELS[r]}</strong>: {ROLE_HINTS[r]}
            </li>
          ))}
        </ul>
      </Card>

      <ul className="flex flex-col gap-4">
        {staff.map((s) => (
          <li key={s.id}>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{s.name}</p>
                <Badge variant="outline">{isRole(s.role) ? ROLE_LABELS[s.role] : s.role}</Badge>
                {s.twoFactorEnabled ? (
                  <Badge>2FA aktiv</Badge>
                ) : (
                  <Badge variant="destructive">2FA ausstehend</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {s.email} · seit {formatDate(s.createdAt)}
              </p>
              {s.id !== actor.id ? (
                <ActionForm
                  action={changeRoleAction.bind(null, s.id)}
                  submitLabel="Rolle ändern"
                  variant="outline"
                  className="max-w-2xl"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField id={`role-${s.id}`} label="Neue Rolle">
                      <Select id={`role-${s.id}`} name="role" defaultValue={s.role}>
                        {STAFF_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                        <option value="customer">Kein Adminzugang mehr (Kundenkonto)</option>
                      </Select>
                    </FormField>
                    <FormField id={`reason-${s.id}`} label="Begründung">
                      <Input id={`reason-${s.id}`} name="reason" required minLength={3} />
                    </FormField>
                  </div>
                </ActionForm>
              ) : (
                <p className="text-xs text-muted-foreground">Das bist du.</p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
