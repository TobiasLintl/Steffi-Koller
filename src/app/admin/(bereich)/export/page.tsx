import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/session";
import { EXPORT_DATASETS, type ExportDataset } from "@/server/services/exports";

export const metadata = { title: "Export" };

export default async function ExportPage() {
  const actor = await requirePermission("exports:orders", "/admin/export");
  const datasets = (Object.keys(EXPORT_DATASETS) as ExportDataset[]).filter((d) =>
    hasPermission(actor.role, EXPORT_DATASETS[d].permission),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Export</h1>
        <p className="text-sm text-muted-foreground">
          Deine Daten gehören dir: Alle Kunden, Käufe, Berechtigungen, Einwilligungen und
          Kursinhalte lassen sich als CSV (für Excel) oder JSON herunterladen. Jeder Export wird im
          Auditlog vermerkt.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {datasets.map((d) => (
          <Card key={d}>
            <CardHeader>
              <CardTitle>{EXPORT_DATASETS[d].label}</CardTitle>
              <CardDescription>
                Enthält personenbezogene Daten – bitte sicher aufbewahren.
              </CardDescription>
            </CardHeader>
            <div className="flex gap-2">
              <a href={`/api/admin/export?dataset=${d}&format=csv`} className={buttonVariants()}>
                CSV
              </a>
              <a
                href={`/api/admin/export?dataset=${d}&format=json`}
                className={buttonVariants({ variant: "outline" })}
              >
                JSON
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
