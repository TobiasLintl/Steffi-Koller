import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import {
  courses,
  entitlements,
  lessonProgress,
  lessons,
  modules,
  products,
} from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import {
  entitlementState,
  isModuleUnlocked,
  lessonAccess,
  moduleUnlocksAt,
  type EntitlementState,
} from "@/server/domain/access";

export interface MyCourse {
  courseId: string;
  slug: string;
  title: string;
  description: string;
  state: EntitlementState;
  startsAt: Date;
  expiresAt: Date | null;
  totalLessons: number;
  completedLessons: number;
  extensionCheckoutUrl: string | null;
}

/** "Meine Kurse": every course the user has an entitlement for – active, expired or revoked. */
export async function listMyCourses(
  db: DbExecutor,
  userId: string,
  now = new Date(),
): Promise<MyCourse[]> {
  const rows = await db
    .select({
      courseId: courses.id,
      slug: courses.slug,
      title: courses.title,
      description: courses.description,
      status: entitlements.status,
      startsAt: entitlements.startsAt,
      expiresAt: entitlements.expiresAt,
    })
    .from(entitlements)
    .innerJoin(courses, eq(courses.id, entitlements.courseId))
    .where(eq(entitlements.userId, userId))
    .orderBy(asc(courses.title));
  if (rows.length === 0) return [];

  const courseIds = rows.map((r) => r.courseId);
  const totals = await db
    .select({ courseId: modules.courseId, count: sql<number>`count(${lessons.id})::int` })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(inArray(modules.courseId, courseIds))
    .groupBy(modules.courseId);
  const done = await db
    .select({ courseId: modules.courseId, count: sql<number>`count(*)::int` })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(
      and(
        eq(lessonProgress.userId, userId),
        isNotNull(lessonProgress.completedAt),
        inArray(modules.courseId, courseIds),
      ),
    )
    .groupBy(modules.courseId);
  const extensions = await db
    .select({ courseId: products.courseId, checkoutUrl: products.checkoutUrl })
    .from(products)
    .where(
      and(
        eq(products.kind, "extension"),
        eq(products.isPublished, true),
        inArray(products.courseId, courseIds),
      ),
    );

  return rows.map((r) => ({
    courseId: r.courseId,
    slug: r.slug,
    title: r.title,
    description: r.description,
    state: entitlementState(
      { status: r.status, startsAt: r.startsAt, expiresAt: r.expiresAt },
      now,
    ),
    startsAt: r.startsAt,
    expiresAt: r.expiresAt,
    totalLessons: totals.find((t) => t.courseId === r.courseId)?.count ?? 0,
    completedLessons: done.find((t) => t.courseId === r.courseId)?.count ?? 0,
    extensionCheckoutUrl: extensions.find((e) => e.courseId === r.courseId)?.checkoutUrl ?? null,
  }));
}

export interface CourseOutline {
  course: { id: string; slug: string; title: string; description: string };
  state: EntitlementState;
  expiresAt: Date | null;
  extensionCheckoutUrl: string | null;
  modules: {
    id: string;
    title: string;
    description: string;
    unlocked: boolean;
    unlocksAt: Date;
    lessons: { id: string; title: string; durationMinutes: number | null; completed: boolean }[];
  }[];
}

async function findEntitlement(db: DbExecutor, userId: string, courseId: string) {
  const [ent] = await db
    .select()
    .from(entitlements)
    .where(and(eq(entitlements.userId, userId), eq(entitlements.courseId, courseId)));
  return ent;
}

/**
 * Course outline for the member area. Returns null when the user has no entitlement for the
 * course at all (AK-07: not purchased → not visible). Titles stay visible when expired/revoked,
 * lesson content does not.
 */
export async function getCourseOutline(
  db: DbExecutor,
  userId: string,
  slug: string,
  now = new Date(),
): Promise<CourseOutline | null> {
  const [course] = await db.select().from(courses).where(eq(courses.slug, slug));
  if (!course) return null;
  const ent = await findEntitlement(db, userId, course.id);
  if (!ent) return null;

  const mods = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, course.id))
    .orderBy(asc(modules.position));
  const allLessons = mods.length
    ? await db
        .select({
          id: lessons.id,
          moduleId: lessons.moduleId,
          title: lessons.title,
          durationMinutes: lessons.durationMinutes,
        })
        .from(lessons)
        .where(
          inArray(
            lessons.moduleId,
            mods.map((m) => m.id),
          ),
        )
        .orderBy(asc(lessons.position))
    : [];
  const progress = allLessons.length
    ? await db
        .select({ lessonId: lessonProgress.lessonId })
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.userId, userId),
            isNotNull(lessonProgress.completedAt),
            inArray(
              lessonProgress.lessonId,
              allLessons.map((l) => l.id),
            ),
          ),
        )
    : [];
  const completed = new Set(progress.map((p) => p.lessonId));
  const [extension] = await db
    .select({ checkoutUrl: products.checkoutUrl })
    .from(products)
    .where(
      and(
        eq(products.courseId, course.id),
        eq(products.kind, "extension"),
        eq(products.isPublished, true),
      ),
    );

  return {
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
    },
    state: entitlementState(ent, now),
    expiresAt: ent.expiresAt,
    extensionCheckoutUrl: extension?.checkoutUrl ?? null,
    modules: mods.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      unlocked: isModuleUnlocked(ent, m, now),
      unlocksAt: moduleUnlocksAt(ent, m),
      lessons: allLessons
        .filter((l) => l.moduleId === m.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          durationMinutes: l.durationMinutes,
          completed: completed.has(l.id),
        })),
    })),
  };
}

export interface LessonView {
  course: { id: string; slug: string; title: string };
  module: { id: string; title: string };
  lesson: {
    id: string;
    title: string;
    body: string;
    transcript: string;
    durationMinutes: number | null;
  };
  completed: boolean;
  previousLessonId: string | null;
  nextLessonId: string | null;
}

export type LessonResult =
  | { status: "ok"; view: LessonView }
  | { status: "not_found" }
  | {
      status: "forbidden";
      reason: "no_entitlement" | "expired" | "revoked" | "locked";
      unlocksAt?: Date;
    };

/** Side-effect free access check for a lesson inside a course (entitlement + drip). */
export async function checkLessonAccess(
  db: DbExecutor,
  userId: string,
  courseSlug: string,
  lessonId: string,
  now = new Date(),
): Promise<{ status: "ok"; courseId: string } | { status: "not_found" } | { status: "forbidden" }> {
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return { status: "not_found" };
  const [row] = await db
    .select({ courseId: courses.id, unlockAfterDays: modules.unlockAfterDays })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(and(eq(lessons.id, lessonId), eq(courses.slug, courseSlug)));
  if (!row) return { status: "not_found" };
  const ent = await findEntitlement(db, userId, row.courseId);
  return lessonAccess(ent, row, now).allowed
    ? { status: "ok", courseId: row.courseId }
    : { status: "forbidden" };
}

/** The only way lesson content leaves the database. Checks entitlement + drip server-side. */
export async function getLessonForUser(
  db: DbExecutor,
  userId: string,
  courseSlug: string,
  lessonId: string,
  now = new Date(),
): Promise<LessonResult> {
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return { status: "not_found" };
  const [row] = await db
    .select({ lesson: lessons, module: modules, course: courses })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(and(eq(lessons.id, lessonId), eq(courses.slug, courseSlug)));
  if (!row) return { status: "not_found" };

  const ent = await findEntitlement(db, userId, row.course.id);
  const access = lessonAccess(ent, row.module, now);
  if (!access.allowed)
    return { status: "forbidden", reason: access.reason, unlocksAt: access.unlocksAt };

  // Neighbour lessons in course order (only for navigation; access is checked again on open).
  const ordered = await db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(eq(modules.courseId, row.course.id))
    .orderBy(asc(modules.position), asc(lessons.position));
  const index = ordered.findIndex((l) => l.id === lessonId);

  const [progress] = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)));
  await db
    .insert(lessonProgress)
    .values({ userId, lessonId, lastViewedAt: now })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { lastViewedAt: now },
    });

  return {
    status: "ok",
    view: {
      course: { id: row.course.id, slug: row.course.slug, title: row.course.title },
      module: { id: row.module.id, title: row.module.title },
      lesson: {
        id: row.lesson.id,
        title: row.lesson.title,
        body: row.lesson.body,
        transcript: row.lesson.transcript,
        durationMinutes: row.lesson.durationMinutes,
      },
      completed: Boolean(progress?.completedAt),
      previousLessonId: index > 0 ? (ordered[index - 1]?.id ?? null) : null,
      nextLessonId:
        index >= 0 && index < ordered.length - 1 ? (ordered[index + 1]?.id ?? null) : null,
    },
  };
}

/** Marks a lesson done/undone – only if the user may access it right now. */
export async function setLessonCompleted(
  db: DbExecutor,
  userId: string,
  courseSlug: string,
  lessonId: string,
  completed: boolean,
  now = new Date(),
): Promise<boolean> {
  const result = await getLessonForUser(db, userId, courseSlug, lessonId, now);
  if (result.status !== "ok") return false;
  await db
    .update(lessonProgress)
    .set({ completedAt: completed ? now : null })
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)));
  return true;
}
