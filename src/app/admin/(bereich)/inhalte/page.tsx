import Link from "next/link";

import { ActionForm } from "@/components/admin/action-form";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listFaq, listPagesForAdmin, listSiteAssets } from "@/server/services/content";
import {
  createFaqAction,
  deleteFaqAction,
  moveFaqAction,
  updateFaqAction,
  uploadImageAction,
} from "./actions";

export const metadata = { title: "Seiten & FAQ" };

export default async function ContentPage() {
  await requirePermission("content:write", "/admin/inhalte");
  const [pages, faq, assets] = await Promise.all([
    listPagesForAdmin(db),
    listFaq(db, { publishedOnly: false }),
    listSiteAssets(db),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Seiten & FAQ</h1>

      <Card>
        <CardHeader>
          <CardTitle>Seiten</CardTitle>
          <CardDescription>
            Texte und Bilder der Website. Rechtstexte bitte 1:1 vom Rechtstext-Dienst übernehmen.
          </CardDescription>
        </CardHeader>
        <ul className="divide-y">
          {pages.map((p) => (
            <li key={p.slug} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Link
                href={`/admin/inhalte/${p.slug}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {p.title}
              </Link>
              <span className="flex items-center gap-2 text-sm">
                {p.kind === "legal" ? <Badge variant="outline">Rechtstext</Badge> : null}
                <span className="text-muted-foreground">
                  {p.updatedAt ? `geändert ${formatDate(p.updatedAt)}` : "Standardtext"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bilder</CardTitle>
          <CardDescription>
            Hochgeladene Bilder kannst du über ihre Bild-ID in Bild- und Einstiegsblöcken verwenden.
          </CardDescription>
        </CardHeader>
        <ActionForm
          action={uploadImageAction}
          submitLabel="Bild hochladen"
          variant="outline"
          className="max-w-xl"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="img-file" label="Datei (JPG, PNG, WebP, max. 5 MB)">
              <Input
                id="img-file"
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </FormField>
            <FormField id="img-alt" label="Bildbeschreibung (Alternativtext)">
              <Input id="img-alt" name="alt" maxLength={200} />
            </FormField>
          </div>
        </ActionForm>
        {assets.length ? (
          <ul className="grid gap-3 sm:grid-cols-3">
            {assets.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                <img
                  src={`/api/assets/${a.id}`}
                  alt={a.alt}
                  className="aspect-video w-full rounded-md border object-cover"
                  loading="lazy"
                />
                <code className="rounded bg-muted px-1 break-all">{a.id}</code>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Häufige Fragen</CardTitle>
        </CardHeader>
        <ul className="flex flex-col gap-4">
          {faq.map((item, i) => (
            <li key={item.id} className="rounded-lg border p-4">
              <ActionForm
                action={updateFaqAction.bind(null, item.id)}
                submitLabel="Speichern"
                variant="outline"
              >
                <FormField id={`q-${item.id}`} label="Frage">
                  <Input
                    id={`q-${item.id}`}
                    name="question"
                    defaultValue={item.question}
                    required
                  />
                </FormField>
                <FormField id={`a-${item.id}`} label="Antwort">
                  <Textarea
                    id={`a-${item.id}`}
                    name="answer"
                    defaultValue={item.answer}
                    rows={3}
                    required
                  />
                </FormField>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isPublished"
                    defaultChecked={item.isPublished}
                    className="size-4"
                  />{" "}
                  veröffentlicht
                </label>
              </ActionForm>
              <div className="mt-2 flex gap-2">
                <form action={moveFaqAction.bind(null, item.id, -1)}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={i === 0}
                    aria-label="Nach oben"
                  >
                    ↑
                  </Button>
                </form>
                <form action={moveFaqAction.bind(null, item.id, 1)}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={i === faq.length - 1}
                    aria-label="Nach unten"
                  >
                    ↓
                  </Button>
                </form>
                <form action={deleteFaqAction.bind(null, item.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Löschen
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <ActionForm action={createFaqAction} submitLabel="Frage hinzufügen" className="max-w-xl">
          <FormField id="new-q" label="Neue Frage">
            <Input id="new-q" name="question" required />
          </FormField>
          <FormField id="new-a" label="Antwort">
            <Textarea id="new-a" name="answer" rows={3} required />
          </FormField>
        </ActionForm>
      </Card>
    </div>
  );
}
