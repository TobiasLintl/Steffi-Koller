import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ActionForm } from "@/components/admin/action-form";
import { SortableList } from "@/components/admin/sortable-list";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { getCourseTree, getLessonForEditor } from "@/server/services/course-editor";
import { listMediaForAdmin } from "@/server/services/media";
import {
  assignLessonMediaAction,
  deleteLessonAction,
  reorderLessonMediaAction,
  toggleLessonMediaDownloadAction,
  unassignLessonMediaAction,
  updateLessonAction,
} from "../../../actions";

export const metadata = { title: "Lektion bearbeiten" };

const KIND = { video: "Video", audio: "Audio", pdf: "PDF" } as const;

export default async function EditLessonPage({
  params,
}: PageProps<"/admin/kurse/[id]/lektion/[lessonId]">) {
  const { id, lessonId } = await params;
  const actor = await requirePermission("courses:write", `/admin/kurse/${id}/lektion/${lessonId}`);
  if (!z.uuid().safeParse(lessonId).success || !z.uuid().safeParse(id).success) notFound();
  const data = await getLessonForEditor(db, lessonId);
  if (!data || data.course.id !== id) notFound();
  const tree = await getCourseTree(db, id);
  const canMedia = hasPermission(actor.role, "media:write");
  const library = canMedia
    ? (await listMediaForAdmin(db)).filter((m) => !data.media.some((a) => a.id === m.id))
    : [];
  const { lesson } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/admin/kurse/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← {data.course.title}
        </Link>
        <h1 className="text-2xl font-semibold">{lesson.title}</h1>
      </div>

      <Card>
        <ActionForm
          action={updateLessonAction.bind(null, id, lesson.id)}
          submitLabel="Lektion speichern"
          className="max-w-3xl"
        >
          <input type="hidden" name="currentModuleId" value={data.module.id} />
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <FormField id="title" label="Titel">
              <Input id="title" name="title" defaultValue={lesson.title} required />
            </FormField>
            <FormField id="duration" label="Dauer (Min.)">
              <Input
                id="duration"
                name="durationMinutes"
                type="number"
                min={1}
                max={600}
                defaultValue={lesson.durationMinutes ?? ""}
              />
            </FormField>
          </div>
          <FormField id="module" label="Modul">
            <Select id="module" name="moduleId" defaultValue={data.module.id}>
              {tree?.modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            id="body"
            label="Text der Lektion"
            hint="Leerzeile = Absatz · „## “ = Zwischenüberschrift · „- “ = Aufzählung"
          >
            <Textarea id="body" name="body" defaultValue={lesson.body} rows={12} />
          </FormField>
          <FormField
            id="transcript"
            label="Transkript"
            hint="Wird unter der Lektion aufklappbar angezeigt (MED-05)."
          >
            <Textarea id="transcript" name="transcript" defaultValue={lesson.transcript} rows={8} />
          </FormField>
        </ActionForm>
      </Card>

      {canMedia ? (
        <Card>
          <CardHeader>
            <CardTitle>Medien dieser Lektion</CardTitle>
            <CardDescription>
              Reihenfolge per Drag & Drop. Download-Freigabe gilt pro Medium.
            </CardDescription>
          </CardHeader>
          {data.media.length ? (
            <>
              <SortableList
                label="Medien"
                items={data.media.map((m) => ({
                  id: m.id,
                  label: m.title,
                  meta: `${KIND[m.kind]}${m.downloadAllowed ? " · Download erlaubt" : ""}`,
                }))}
                onReorder={reorderLessonMediaAction.bind(null, id, lesson.id)}
              />
              <ul className="flex flex-col gap-1 text-sm">
                {data.media.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2">
                    <span className="flex-1">{m.title}</span>
                    {m.kind !== "video" ? (
                      <form
                        action={toggleLessonMediaDownloadAction.bind(
                          null,
                          id,
                          lesson.id,
                          m.id,
                          !m.downloadAllowed,
                        )}
                      >
                        <Button type="submit" variant="outline" size="sm">
                          Download {m.downloadAllowed ? "sperren" : "erlauben"}
                        </Button>
                      </form>
                    ) : null}
                    <form action={unassignLessonMediaAction.bind(null, id, lesson.id, m.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Entfernen
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Medien.</p>
          )}
          <ActionForm
            action={assignLessonMediaAction.bind(null, id, lesson.id)}
            submitLabel="Medium hinzufügen"
            variant="outline"
            className="max-w-xl"
          >
            <Select name="mediaId" defaultValue="" aria-label="Medium aus der Bibliothek">
              <option value="" disabled>
                Medium aus der Bibliothek wählen
              </option>
              {library.map((m) => (
                <option key={m.id} value={m.id}>
                  {KIND[m.kind]}: {m.title}
                </option>
              ))}
            </Select>
          </ActionForm>
          <Link href="/admin/medien" className="text-sm underline underline-offset-4">
            Neue Medien hochladen
          </Link>
        </Card>
      ) : null}

      <Card>
        <ActionForm
          action={deleteLessonAction.bind(null, id, lesson.id)}
          submitLabel="Lektion löschen"
          variant="destructive"
          confirm="Lektion löschen? Der Lernfortschritt dazu geht verloren."
        />
      </Card>
    </div>
  );
}
