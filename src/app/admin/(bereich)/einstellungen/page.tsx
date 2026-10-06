import { ActionForm } from "@/components/admin/action-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { getRefundPolicy } from "@/server/services/settings";
import { saveRefundPolicyAction } from "./actions";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  await requirePermission("settings:write", "/admin/einstellungen");
  const policy = await getRefundPolicy(db);
  const env = serverEnv();
  const base = env.NEXT_PUBLIC_APP_URL;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>

      <Card>
        <CardHeader>
          <CardTitle>Rückerstattung, Storno, Rücklastschrift</CardTitle>
          <CardDescription>
            Offene Entscheidung D-01. Was soll mit dem Kurszugang passieren, wenn der Reseller eine
            Rückerstattung oder Rücklastschrift meldet?
          </CardDescription>
        </CardHeader>
        <ActionForm action={saveRefundPolicyAction} submitLabel="Speichern" className="max-w-xl">
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="sr-only">Regel</legend>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="action"
                value="revoke"
                defaultChecked={policy.action === "revoke"}
                className="mt-0.5 size-4"
              />
              <span>
                Zugang sofort sperren (bei Verlängerungen: Verlängerung zurücknehmen) –{" "}
                <em>Standard</em>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="action"
                value="keep"
                defaultChecked={policy.action === "keep"}
                className="mt-0.5 size-4"
              />
              <span>Zugang unverändert lassen (manuelle Prüfung)</span>
            </label>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="notifyAdmin"
              defaultChecked={policy.notifyAdmin}
              className="size-4"
            />
            Admin benachrichtigen
          </label>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook-Adressen für die Reseller</CardTitle>
          <CardDescription>
            Diese URLs trägst du in den IPN-Einstellungen beim Reseller ein.
          </CardDescription>
        </CardHeader>
        <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">CopeCart</dt>
          <dd>
            <code className="rounded bg-muted px-1 break-all">{base}/api/webhooks/copecart</code>{" "}
            {env.COPECART_WEBHOOK_SECRET
              ? "· Secret gesetzt"
              : "· Secret fehlt (COPECART_WEBHOOK_SECRET)"}
          </dd>
          <dt className="text-muted-foreground">Digistore24</dt>
          <dd>
            <code className="rounded bg-muted px-1 break-all">{base}/api/webhooks/digistore24</code>{" "}
            {env.DIGISTORE24_IPN_PASSPHRASE
              ? "· Passphrase gesetzt"
              : "· Passphrase fehlt (DIGISTORE24_IPN_PASSPHRASE)"}
          </dd>
        </dl>
      </Card>
    </div>
  );
}
