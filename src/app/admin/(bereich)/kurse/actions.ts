"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fieldErrorsFrom, type ActionState } from "@/lib/action-state";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  courseInputSchema,
  lessonInputSchema,
  moduleInputSchema,
} from "@/server/domain/catalog/schemas";
import {
  addLesson,
  addModule,
  createCourse,
  deleteCourse,
  deleteLesson,
  deleteModule,
  moveLessonToModule,
  reorderLessonMedia,
  reorderLessons,
  reorderModules,
  updateCourse,
  updateLesson,
  updateModule,
} from "@/server/services/course-editor";
import { assignMediaToLesson, setDownloadAllowed, unassignMedia } from "@/server/services/media";
import { CatalogError } from "@/server/services/products";

const guard = () => requirePermission("courses:write", "/admin/kurse");
const uuid = (v: string) => z.uuid().parse(v);

function catalogError(error: unknown): ActionState {
  if (error instanceof CatalogError) return { ok: false, message: error.message };
  throw error;
}

function courseFrom(formData: FormData) {
  return courseInputSchema.safeParse({
    ...Object.fromEntries(formData),
    isPublished: formData.get("isPublished") === "on",
  });
}

export async function createCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guard();
  const parsed = courseFrom(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  let id: string;
  try {
    id = await createCourse(db, parsed.data);
  } catch (error) {
    return catalogError(error);
  }
  redirect(`/admin/kurse/${id}`);
}

export async function updateCourseAction(
  courseId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guard();
  const parsed = courseFrom(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  try {
    await updateCourse(db, uuid(courseId), parsed.data);
  } catch (error) {
    return catalogError(error);
  }
  revalidatePath(`/admin/kurse/${courseId}`);
  return { ok: true, message: "Gespeichert." };
}

export async function deleteCourseAction(courseId: string): Promise<ActionState> {
  const actor = await guard();
  try {
    await deleteCourse(db, actor, uuid(courseId));
  } catch (error) {
    return catalogError(error);
  }
  redirect("/admin/kurse");
}

export async function addModuleAction(
  courseId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guard();
  const parsed = moduleInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  await addModule(db, uuid(courseId), parsed.data);
  revalidatePath(`/admin/kurse/${courseId}`);
  return { ok: true, message: "Modul angelegt." };
}

export async function updateModuleAction(
  courseId: string,
  moduleId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guard();
  const parsed = moduleInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  await updateModule(db, uuid(moduleId), parsed.data);
  revalidatePath(`/admin/kurse/${courseId}`);
  return { ok: true, message: "Gespeichert." };
}

export async function deleteModuleAction(courseId: string, moduleId: string): Promise<ActionState> {
  await guard();
  try {
    await deleteModule(db, uuid(moduleId));
  } catch (error) {
    return catalogError(error);
  }
  revalidatePath(`/admin/kurse/${courseId}`);
  return { ok: true, message: "Modul gelöscht." };
}

export async function reorderModulesAction(courseId: string, ids: string[]): Promise<void> {
  await guard();
  await reorderModules(db, uuid(courseId), ids.map(uuid));
  revalidatePath(`/admin/kurse/${courseId}`);
}

export async function addLessonAction(
  courseId: string,
  moduleId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guard();
  const title = z.string().trim().min(1).max(200).safeParse(formData.get("title"));
  if (!title.success) return { ok: false, message: "Bitte einen Titel angeben." };
  const id = await addLesson(db, uuid(moduleId), title.data);
  redirect(`/admin/kurse/${courseId}/lektion/${id}`);
}

export async function reorderLessonsAction(
  courseId: string,
  moduleId: string,
  ids: string[],
): Promise<void> {
  await guard();
  await reorderLessons(db, uuid(moduleId), ids.map(uuid));
  revalidatePath(`/admin/kurse/${courseId}`);
}

export async function updateLessonAction(
  courseId: string,
  lessonId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guard();
  const parsed = lessonInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  await updateLesson(db, uuid(lessonId), parsed.data);
  const moduleId = formData.get("moduleId");
  if (typeof moduleId === "string" && moduleId && formData.get("currentModuleId") !== moduleId) {
    await moveLessonToModule(db, uuid(lessonId), uuid(moduleId));
  }
  revalidatePath(`/admin/kurse/${courseId}`);
  revalidatePath(`/admin/kurse/${courseId}/lektion/${lessonId}`);
  return { ok: true, message: "Gespeichert." };
}

export async function deleteLessonAction(courseId: string, lessonId: string): Promise<ActionState> {
  await guard();
  await deleteLesson(db, uuid(lessonId));
  redirect(`/admin/kurse/${courseId}`);
}

export async function assignLessonMediaAction(
  courseId: string,
  lessonId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("media:write", "/admin/kurse");
  const mediaId = z.uuid().safeParse(formData.get("mediaId"));
  if (!mediaId.success) return { ok: false, message: "Bitte ein Medium wählen." };
  await assignMediaToLesson(db, mediaId.data, uuid(lessonId));
  revalidatePath(`/admin/kurse/${courseId}/lektion/${lessonId}`);
  return { ok: true, message: "Medium zugeordnet." };
}

export async function unassignLessonMediaAction(
  courseId: string,
  lessonId: string,
  mediaId: string,
): Promise<void> {
  await requirePermission("media:write", "/admin/kurse");
  await unassignMedia(db, uuid(mediaId), uuid(lessonId));
  revalidatePath(`/admin/kurse/${courseId}/lektion/${lessonId}`);
}

export async function reorderLessonMediaAction(
  courseId: string,
  lessonId: string,
  ids: string[],
): Promise<void> {
  await requirePermission("media:write", "/admin/kurse");
  await reorderLessonMedia(db, uuid(lessonId), ids.map(uuid));
  revalidatePath(`/admin/kurse/${courseId}/lektion/${lessonId}`);
}

export async function toggleLessonMediaDownloadAction(
  courseId: string,
  lessonId: string,
  mediaId: string,
  allowed: boolean,
): Promise<void> {
  await requirePermission("media:write", "/admin/kurse");
  await setDownloadAllowed(db, uuid(mediaId), allowed);
  revalidatePath(`/admin/kurse/${courseId}/lektion/${lessonId}`);
}
