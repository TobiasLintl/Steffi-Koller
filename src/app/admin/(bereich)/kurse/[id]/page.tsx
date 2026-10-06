import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ActionForm } from "@/components/admin/action-form";
import { CourseFields } from "@/components/admin/course-fields";
import { SortableList } from "@/components/admin/sortable-list";
import { FormField } from "@/components/form-field";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { getCourseTree } from "@/server/services/course-editor";
import {
  addLessonAction,
  addModuleAction,
  deleteCourseAction,
  deleteModuleAction,
  reorderLessonsAction,
  reorderModulesAction,
  updateCourseAction,
  updateModuleAction,
} from "../actions";

export const metadata = { title: "Kurs bearbeiten" };

export default async function EditCoursePage({ params }: PageProps<"/admin/kurse/[id]">) {
  const { id } = await params;
  const actor = await requirePermission("courses:read", `/admin/kurse/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const tree = await getCourseTree(db, id);
  if (!tree) notFound();
  const canWrite = hasPermission(actor.role, "courses:write");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/kurse" className="text-sm text-muted-foreground hover:underline">
          ← Kurse
        </Link>
        <h1 className="text-2xl font-semibold">{tree.course.title}</h1>
      </div>

      {canWrite ? (
        <Card>
          <ActionForm
            action={updateCourseAction.bind(null, id)}
            submitLabel="Speichern"
            variant="outline"
            className="max-w-2xl"
          >
            <CourseFields values={tree.course} />
          </ActionForm>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Reihenfolge der Module</CardTitle>
          <CardDescription>Per Drag & Drop oder mit den Pfeilen sortieren.</CardDescription>
        </CardHeader>
        <SortableList
          label="Module"
          items={tree.modules.map((m) => ({
            id: m.id,
            label: m.title,
            meta: m.unlockAfterDays ? `ab Tag ${m.unlockAfterDays}` : "sofort",
          }))}
          onReorder={reorderModulesAction.bind(null, id)}
        />
      </Card>

      {tree.modules.map((mod, i) => (
        <Card key={mod.id}>
          <CardHeader>
            <CardTitle>
              Modul {i + 1}: {mod.title}
            </CardTitle>
            <CardDescription>
              {mod.unlockAfterDays
                ? `Drip: freigeschaltet ${mod.unlockAfterDays} Tage nach Kaufbeginn`
                : "Sofort verfügbar"}
            </CardDescription>
          </CardHeader>
          {canWrite ? (
            <ActionForm
              action={updateModuleAction.bind(null, id, mod.id)}
              submitLabel="Modul speichern"
              variant="outline"
              className="max-w-2xl"
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                <FormField id={`mt-${mod.id}`} label="Titel">
                  <Input id={`mt-${mod.id}`} name="title" defaultValue={mod.title} required />
                </FormField>
                <FormField id={`md-${mod.id}`} label="Freischaltung nach Tagen">
                  <Input
                    id={`md-${mod.id}`}
                    name="unlockAfterDays"
                    type="number"
                    min={0}
                    max={3650}
                    defaultValue={mod.unlockAfterDays}
                  />
                </FormField>
              </div>
              <FormField id={`mdesc-${mod.id}`} label="Beschreibung">
                <Input id={`mdesc-${mod.id}`} name="description" defaultValue={mod.description} />
              </FormField>
            </ActionForm>
          ) : null}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Lektionen</p>
            {mod.lessons.length ? (
              <SortableList
                label={`Lektionen in ${mod.title}`}
                items={mod.lessons.map((l) => ({
                  id: l.id,
                  label: l.title,
                  href: `/admin/kurse/${id}/lektion/${l.id}`,
                  meta: l.durationMinutes ? `${l.durationMinutes} Min.` : undefined,
                }))}
                onReorder={reorderLessonsAction.bind(null, id, mod.id)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Lektionen.</p>
            )}
          </div>
          {canWrite ? (
            <div className="grid gap-4 md:grid-cols-2">
              <ActionForm
                action={addLessonAction.bind(null, id, mod.id)}
                submitLabel="Lektion hinzufügen"
                variant="outline"
              >
                <FormField id={`nl-${mod.id}`} label="Neue Lektion">
                  <Input
                    id={`nl-${mod.id}`}
                    name="title"
                    placeholder="Titel der Lektion"
                    required
                  />
                </FormField>
              </ActionForm>
              {mod.lessons.length === 0 ? (
                <ActionForm
                  action={deleteModuleAction.bind(null, id, mod.id)}
                  submitLabel="Modul löschen"
                  variant="destructive"
                  confirm="Modul löschen?"
                />
              ) : null}
            </div>
          ) : null}
        </Card>
      ))}

      {canWrite ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Neues Modul</CardTitle>
            </CardHeader>
            <ActionForm
              action={addModuleAction.bind(null, id)}
              submitLabel="Modul anlegen"
              className="max-w-2xl"
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                <FormField id="nm-title" label="Titel">
                  <Input id="nm-title" name="title" required />
                </FormField>
                <FormField id="nm-days" label="Freischaltung nach Tagen" hint="0 = sofort">
                  <Input
                    id="nm-days"
                    name="unlockAfterDays"
                    type="number"
                    min={0}
                    defaultValue={0}
                  />
                </FormField>
              </div>
            </ActionForm>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Kurs löschen</CardTitle>
              <CardDescription>
                Nur ohne Teilnehmende und ohne zugeordnete Produkte möglich.
              </CardDescription>
            </CardHeader>
            <ActionForm
              action={deleteCourseAction.bind(null, id)}
              submitLabel="Kurs löschen"
              variant="destructive"
              confirm="Kurs mit allen Modulen und Lektionen löschen?"
            />
          </Card>
        </>
      ) : null}
    </div>
  );
}
