import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/admin/action-form";
import { BlockFields } from "@/components/admin/block-fields";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { BLOCK_LABELS } from "@/server/domain/content/blocks";
import { pageDefault } from "@/server/domain/content/defaults";
import { getPage } from "@/server/services/content";
import {
  addBlockAction,
  deleteBlockAction,
  moveBlockAction,
  saveBlockAction,
  savePageMetaAction,
} from "../actions";

export const metadata = { title: "Seite bearbeiten" };

export default async function EditPagePage({ params }: PageProps<"/admin/inhalte/[slug]">) {
  const { slug } = await params;
  await requirePermission("content:write", `/admin/inhalte/${slug}`);
  if (!pageDefault(slug)) notFound();
  const page = await getPage(db, slug);
  if (!page) notFound();
  const publicPath = slug === "start" ? "/" : `/${slug}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/inhalte" className="text-sm text-muted-foreground hover:underline">
          ← Seiten & FAQ
        </Link>
        <h1 className="text-2xl font-semibold">{page.title}</h1>
        <Link href={publicPath} className="text-sm underline underline-offset-4" target="_blank">
          Seite ansehen
        </Link>
      </div>

      <Card>
        <ActionForm
          action={savePageMetaAction.bind(null, slug)}
          submitLabel="Speichern"
          variant="outline"
          className="max-w-xl"
        >
          <FormField id="title" label="Seitentitel">
            <Input id="title" name="title" defaultValue={page.title} required />
          </FormField>
          <FormField id="meta" label="Beschreibung für Suchmaschinen" hint="Etwa 150 Zeichen.">
            <Input
              id="meta"
              name="metaDescription"
              defaultValue={page.metaDescription}
              maxLength={300}
            />
          </FormField>
        </ActionForm>
      </Card>

      <ol className="flex flex-col gap-4">
        {page.blocks.map((block, i) => (
          <li key={block.id}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>
                    <Badge variant="secondary">{BLOCK_LABELS[block.type]}</Badge>
                  </CardTitle>
                  <div className="flex gap-1">
                    <form action={moveBlockAction.bind(null, slug, block.id, -1)}>
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
                    <form action={moveBlockAction.bind(null, slug, block.id, 1)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={i === page.blocks.length - 1}
                        aria-label="Nach unten"
                      >
                        ↓
                      </Button>
                    </form>
                    <form action={deleteBlockAction.bind(null, slug, block.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Entfernen
                      </Button>
                    </form>
                  </div>
                </div>
              </CardHeader>
              <ActionForm
                action={saveBlockAction.bind(null, slug, block.id)}
                submitLabel="Block speichern"
                variant="outline"
              >
                <BlockFields block={block} />
              </ActionForm>
            </Card>
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>Block hinzufügen</CardTitle>
        </CardHeader>
        <ActionForm
          action={addBlockAction.bind(null, slug)}
          submitLabel="Hinzufügen"
          className="max-w-sm"
        >
          <Select name="type" aria-label="Blocktyp" defaultValue="text">
            {Object.entries(BLOCK_LABELS).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </Select>
        </ActionForm>
      </Card>
    </div>
  );
}
