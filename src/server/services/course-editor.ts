import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";

import { writeAudit } from "@/server/audit/log";
import {
  courses,
  entitlements,
  lessonMedia,
  lessons,
  media,
  modules,
  products,
} from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import {
  positionsFor,
  type courseInputSchema,
  type lessonInputSchema,
  type moduleInputSchema,
} from "@/server/domain/catalog/schemas";
import type { StaffActor } from "./access";
import { CatalogError } from "./products";

/** Qualified reference for correlated subqueries (single-table selects are unqualified). */
const COURSE_ID = sql.raw('"courses"."id"');

type CourseInput = z.infer<typeof courseInputSchema>;
type ModuleInput = z.infer<typeof moduleInputSchema>;
type LessonInput = z.infer<typeof lessonInputSchema>;

export async function listCoursesForAdmin(db: DbExecutor) {
  return db
    .select({
      course: courses,
      moduleCount: sql<number>`(select count(*)::int from ${modules} where ${modules.courseId} = ${COURSE_ID})`,
      lessonCount: sql<number>`(select count(*)::int from ${lessons} join ${modules} m on m.id = ${lessons.moduleId} where m.course_id = ${COURSE_ID})`,
      learnerCount: sql<number>`(select count(*)::int from ${entitlements} where ${entitlements.courseId} = ${COURSE_ID})`,
    })
    .from(courses)
    .orderBy(asc(courses.title));
}

export async function getCourseTree(db: DbExecutor, courseId: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) return null;
  const mods = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.position));
  const ls = mods.length
    ? await db
        .select()
        .from(lessons)
        .where(
          inArray(
            lessons.moduleId,
            mods.map((m) => m.id),
          ),
        )
        .orderBy(asc(lessons.position))
    : [];
  return {
    course,
    modules: mods.map((m) => ({ ...m, lessons: ls.filter((l) => l.moduleId === m.id) })),
  };
}

export async function createCourse(db: DbExecutor, input: CourseInput): Promise<string> {
  const [taken] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.slug, input.slug));
  if (taken) throw new CatalogError("Diese Adresse (Slug) ist schon vergeben.");
  const [row] = await db.insert(courses).values(input).returning({ id: courses.id });
  return row!.id;
}

export async function updateCourse(
  db: DbExecutor,
  courseId: string,
  input: CourseInput,
): Promise<void> {
  const [taken] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.slug, input.slug));
  if (taken && taken.id !== courseId)
    throw new CatalogError("Diese Adresse (Slug) ist schon vergeben.");
  await db
    .update(courses)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(courses.id, courseId));
}

export async function deleteCourse(
  db: DbExecutor,
  actor: StaffActor,
  courseId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [ent] = await tx
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(eq(entitlements.courseId, courseId))
      .limit(1);
    if (ent)
      throw new CatalogError(
        "Der Kurs hat Teilnehmende und kann nicht gelöscht werden. Setze ihn auf „nicht veröffentlicht“.",
      );
    const [product] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.courseId, courseId))
      .limit(1);
    if (product) throw new CatalogError("Dem Kurs sind noch Produkte zugeordnet.");
    // Media stay in the library; only the lesson assignments go.
    const lessonIds = (
      await tx
        .select({ id: lessons.id })
        .from(lessons)
        .innerJoin(modules, eq(modules.id, lessons.moduleId))
        .where(eq(modules.courseId, courseId))
    ).map((l) => l.id);
    if (lessonIds.length)
      await tx.delete(lessonMedia).where(inArray(lessonMedia.lessonId, lessonIds));
    const [removed] = await tx
      .delete(courses)
      .where(eq(courses.id, courseId))
      .returning({ title: courses.title });
    if (removed)
      await writeAudit(tx, {
        action: "course.deleted",
        actorUserId: actor.id,
        actorRole: actor.role,
        targetType: "course",
        targetId: courseId,
        metadata: { title: removed.title },
      });
  });
}

export async function addModule(
  db: DbExecutor,
  courseId: string,
  input: ModuleInput,
): Promise<string> {
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${modules.position}) + 1, 0)::int` })
    .from(modules)
    .where(eq(modules.courseId, courseId));
  const [row] = await db
    .insert(modules)
    .values({ courseId, ...input, position: next })
    .returning({ id: modules.id });
  return row!.id;
}

export async function updateModule(
  db: DbExecutor,
  moduleId: string,
  input: ModuleInput,
): Promise<void> {
  await db
    .update(modules)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(modules.id, moduleId));
}

export async function deleteModule(db: DbExecutor, moduleId: string): Promise<void> {
  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .limit(1);
  if (lesson)
    throw new CatalogError("Bitte zuerst die Lektionen des Moduls löschen oder verschieben.");
  await db.delete(modules).where(eq(modules.id, moduleId));
}

/** Drag & drop: persists a new module order. All ids must belong to the course. */
export async function reorderModules(
  db: DbExecutor,
  courseId: string,
  ids: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.courseId, courseId));
    if (existing.length !== ids.length || !existing.every((m) => ids.includes(m.id)))
      throw new CatalogError("Ungültige Reihenfolge.");
    for (const { id, position } of positionsFor(ids))
      await tx.update(modules).set({ position }).where(eq(modules.id, id));
  });
}

export async function addLesson(db: DbExecutor, moduleId: string, title: string): Promise<string> {
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${lessons.position}) + 1, 0)::int` })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId));
  const [row] = await db
    .insert(lessons)
    .values({ moduleId, title, position: next })
    .returning({ id: lessons.id });
  return row!.id;
}

export async function getLessonForEditor(db: DbExecutor, lessonId: string) {
  const [row] = await db
    .select({ lesson: lessons, module: modules, course: courses })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(eq(lessons.id, lessonId));
  if (!row) return null;
  const assigned = await db
    .select({ media, position: lessonMedia.position })
    .from(lessonMedia)
    .innerJoin(media, eq(media.id, lessonMedia.mediaId))
    .where(eq(lessonMedia.lessonId, lessonId))
    .orderBy(asc(lessonMedia.position));
  return { ...row, media: assigned.map((a) => a.media) };
}

export async function updateLesson(
  db: DbExecutor,
  lessonId: string,
  input: LessonInput,
): Promise<void> {
  await db
    .update(lessons)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(lessons.id, lessonId));
}

export async function moveLessonToModule(
  db: DbExecutor,
  lessonId: string,
  moduleId: string,
): Promise<void> {
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${lessons.position}) + 1, 0)::int` })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId));
  await db
    .update(lessons)
    .set({ moduleId, position: next, updatedAt: new Date() })
    .where(eq(lessons.id, lessonId));
}

export async function deleteLesson(db: DbExecutor, lessonId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(lessonMedia).where(eq(lessonMedia.lessonId, lessonId));
    await tx.delete(lessons).where(eq(lessons.id, lessonId));
  });
}

export async function reorderLessons(
  db: DbExecutor,
  moduleId: string,
  ids: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.moduleId, moduleId));
    if (existing.length !== ids.length || !existing.every((l) => ids.includes(l.id)))
      throw new CatalogError("Ungültige Reihenfolge.");
    for (const { id, position } of positionsFor(ids))
      await tx.update(lessons).set({ position }).where(eq(lessons.id, id));
  });
}

export async function reorderLessonMedia(
  db: DbExecutor,
  lessonId: string,
  mediaIds: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const { id, position } of positionsFor(mediaIds)) {
      await tx
        .update(lessonMedia)
        .set({ position })
        .where(and(eq(lessonMedia.lessonId, lessonId), eq(lessonMedia.mediaId, id)));
    }
  });
}
