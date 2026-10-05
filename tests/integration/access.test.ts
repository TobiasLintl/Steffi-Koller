import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { auditLog, entitlementEvents, entitlements } from "@/server/db/schema";
import {
  adminGrantAccess,
  adminRevokeAccess,
  extendAccess,
  grantAccess,
  revokeAccess,
} from "@/server/services/access";
import {
  getCourseOutline,
  getLessonForUser,
  listMyCourses,
  setLessonCompleted,
} from "@/server/services/learning";
import { closeTestDb, createUser, resetTables, testDb } from "../support/db";
import { createCourse } from "../support/fixtures";

const d = (iso: string) => new Date(iso);

afterAll(closeTestDb);

describe("entitlements", () => {
  const db = testDb();
  beforeEach(() => resetTables(db));

  it("AK-05: grants 6 months for a small course and 24 months for the large one", async () => {
    const user = await createUser(db);
    const small = await createCourse(db);
    const large = await createCourse(db);
    const now = d("2026-03-10T12:00:00Z");

    const a = await grantAccess(db, {
      userId: user.id,
      courseId: small.course.id,
      accessMonths: 6,
      source: "purchase",
      now,
    });
    const b = await grantAccess(db, {
      userId: user.id,
      courseId: large.course.id,
      accessMonths: 24,
      source: "purchase",
      now,
    });
    expect(a.expiresAt).toEqual(d("2026-09-10T12:00:00Z"));
    expect(b.expiresAt).toEqual(d("2028-03-10T12:00:00Z"));

    const courses = await listMyCourses(db, user.id, d("2026-09-11T00:00:00Z"));
    expect(courses.find((c) => c.courseId === small.course.id)?.state).toBe("expired");
    expect(courses.find((c) => c.courseId === large.course.id)?.state).toBe("active");
  });

  it("AK-06: extension adds 3 months to the same record and logs an event", async () => {
    const user = await createUser(db);
    const { course } = await createCourse(db);
    await grantAccess(db, {
      userId: user.id,
      courseId: course.id,
      accessMonths: 6,
      source: "purchase",
      now: d("2026-01-01T00:00:00Z"),
    });

    const change = await extendAccess(db, {
      userId: user.id,
      courseId: course.id,
      months: 3,
      source: "purchase",
      now: d("2026-05-01T00:00:00Z"),
    });
    expect(change).toMatchObject({ result: "extended", expiresAt: d("2026-10-01T00:00:00Z") });

    const rows = await db.select().from(entitlements).where(eq(entitlements.userId, user.id));
    expect(rows).toHaveLength(1);
    const events = await db
      .select()
      .from(entitlementEvents)
      .where(eq(entitlementEvents.entitlementId, rows[0]!.id));
    expect(events.map((e) => e.type).sort()).toEqual(["extended", "granted"]);
  });

  it("AK-06: extending an expired entitlement counts from now", async () => {
    const user = await createUser(db);
    const { course } = await createCourse(db);
    await grantAccess(db, {
      userId: user.id,
      courseId: course.id,
      accessMonths: 24,
      source: "purchase",
      now: d("2024-01-01T00:00:00Z"),
    });
    const change = await extendAccess(db, {
      userId: user.id,
      courseId: course.id,
      months: 6,
      source: "purchase",
      now: d("2026-02-15T00:00:00Z"),
    });
    expect(change.expiresAt).toEqual(d("2026-08-15T00:00:00Z"));
  });

  it("concurrent grants never create a second record", async () => {
    const user = await createUser(db);
    const { course } = await createCourse(db);
    const now = d("2026-01-01T00:00:00Z");
    await Promise.all(
      Array.from({ length: 5 }, () =>
        grantAccess(db, {
          userId: user.id,
          courseId: course.id,
          accessMonths: 6,
          source: "purchase",
          now,
        }),
      ),
    );
    const rows = await db
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.userId, user.id), eq(entitlements.courseId, course.id)));
    expect(rows).toHaveLength(1);
  });

  it("revoked entitlements are not extended, but can be reinstated by a new grant", async () => {
    const user = await createUser(db);
    const { course } = await createCourse(db);
    await grantAccess(db, {
      userId: user.id,
      courseId: course.id,
      accessMonths: 6,
      source: "purchase",
    });
    await revokeAccess(db, { userId: user.id, courseId: course.id, reason: "refund" });
    expect(
      (
        await extendAccess(db, {
          userId: user.id,
          courseId: course.id,
          months: 3,
          source: "purchase",
        })
      ).result,
    ).toBe("skipped_revoked");
    expect(
      (
        await grantAccess(db, {
          userId: user.id,
          courseId: course.id,
          accessMonths: 6,
          source: "manual",
        })
      ).result,
    ).toBe("reinstated");
  });

  it("manual admin changes require a reason and are written to the audit log", async () => {
    const user = await createUser(db);
    const admin = await createUser(db, { role: "support" });
    const { course } = await createCourse(db);
    const change = await adminGrantAccess(
      db,
      { id: admin.id, role: "support" },
      { userId: user.id, courseId: course.id, accessMonths: 6, reason: "Kulanz nach Telefonat" },
    );
    await adminRevokeAccess(
      db,
      { id: admin.id, role: "support" },
      { userId: user.id, courseId: course.id, reason: "Missbrauch" },
    );
    const entries = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, change.entitlementId));
    expect(entries.map((e) => [e.action, e.reason])).toEqual([
      ["entitlement.granted", "Kulanz nach Telefonat"],
      ["entitlement.revoked", "Missbrauch"],
    ]);
  });
});

describe("member area access (AK-07)", () => {
  const db = testDb();
  beforeEach(() => resetTables(db));

  it("courses without entitlement are invisible and their lessons are not delivered", async () => {
    const user = await createUser(db);
    const { course, modules } = await createCourse(db);
    expect(await getCourseOutline(db, user.id, course.slug)).toBeNull();
    expect(await listMyCourses(db, user.id)).toEqual([]);
    const result = await getLessonForUser(db, user.id, course.slug, modules[0]!.lessonIds[0]!);
    expect(result).toEqual({ status: "forbidden", reason: "no_entitlement", unlocksAt: undefined });
  });

  it("expired courses stay listed but lesson content is locked", async () => {
    const user = await createUser(db);
    const { course, modules } = await createCourse(db);
    await grantAccess(db, {
      userId: user.id,
      courseId: course.id,
      accessMonths: 6,
      source: "purchase",
      now: d("2025-01-01T00:00:00Z"),
    });
    const outline = await getCourseOutline(db, user.id, course.slug, d("2026-01-01T00:00:00Z"));
    expect(outline?.state).toBe("expired");
    const result = await getLessonForUser(
      db,
      user.id,
      course.slug,
      modules[0]!.lessonIds[0]!,
      d("2026-01-01T00:00:00Z"),
    );
    expect(result).toMatchObject({ status: "forbidden", reason: "expired" });
  });

  it("drip: later modules are locked until their unlock date", async () => {
    const user = await createUser(db);
    const { course, modules } = await createCourse(db, {
      modules: [{ unlockAfterDays: 0 }, { unlockAfterDays: 30 }],
    });
    const start = d("2026-01-01T00:00:00Z");
    await grantAccess(db, {
      userId: user.id,
      courseId: course.id,
      accessMonths: 24,
      source: "purchase",
      now: start,
    });

    const early = d("2026-01-10T00:00:00Z");
    expect(
      (await getLessonForUser(db, user.id, course.slug, modules[0]!.lessonIds[0]!, early)).status,
    ).toBe("ok");
    expect(
      await getLessonForUser(db, user.id, course.slug, modules[1]!.lessonIds[0]!, early),
    ).toMatchObject({
      status: "forbidden",
      reason: "locked",
      unlocksAt: d("2026-01-31T00:00:00Z"),
    });
    expect(
      (
        await getLessonForUser(
          db,
          user.id,
          course.slug,
          modules[1]!.lessonIds[0]!,
          d("2026-02-01T00:00:00Z"),
        )
      ).status,
    ).toBe("ok");
  });

  it("progress can only be recorded for accessible lessons", async () => {
    const user = await createUser(db);
    const other = await createUser(db);
    const { course, modules } = await createCourse(db);
    await grantAccess(db, {
      userId: user.id,
      courseId: course.id,
      accessMonths: 6,
      source: "purchase",
    });
    const lessonId = modules[0]!.lessonIds[0]!;
    expect(await setLessonCompleted(db, user.id, course.slug, lessonId, true)).toBe(true);
    expect(await setLessonCompleted(db, other.id, course.slug, lessonId, true)).toBe(false);
    const [mine] = await listMyCourses(db, user.id);
    expect(mine).toMatchObject({ completedLessons: 1, totalLessons: 2 });
  });

  it("lesson ids of another course are not resolvable via a purchased course slug", async () => {
    const user = await createUser(db);
    const owned = await createCourse(db);
    const foreign = await createCourse(db);
    await grantAccess(db, {
      userId: user.id,
      courseId: owned.course.id,
      accessMonths: 6,
      source: "purchase",
    });
    expect(
      await getLessonForUser(db, user.id, owned.course.slug, foreign.modules[0]!.lessonIds[0]!),
    ).toEqual({ status: "not_found" });
  });
});
