import { randomUUID } from "node:crypto";

import type { Db } from "@/server/db";
import { courses, lessons, modules, products } from "@/server/db/schema";
import type { ProductTier } from "@/server/domain/access";

export async function createCourse(
  db: Db,
  input: { title?: string; modules?: { unlockAfterDays?: number; lessons?: number }[] } = {},
) {
  const slug = `kurs-${randomUUID().slice(0, 8)}`;
  const [course] = await db
    .insert(courses)
    .values({ slug, title: input.title ?? "Testkurs", isPublished: true })
    .returning();
  const createdModules: { id: string; lessonIds: string[] }[] = [];
  for (const [i, m] of (input.modules ?? [{ lessons: 2 }]).entries()) {
    const [mod] = await db
      .insert(modules)
      .values({
        courseId: course!.id,
        title: `Modul ${i + 1}`,
        position: i,
        unlockAfterDays: m.unlockAfterDays ?? 0,
      })
      .returning();
    const lessonIds: string[] = [];
    for (let j = 0; j < (m.lessons ?? 1); j += 1) {
      const [lesson] = await db
        .insert(lessons)
        .values({
          moduleId: mod!.id,
          title: `Lektion ${i + 1}.${j + 1}`,
          position: j,
          body: "Geheimer Inhalt",
        })
        .returning();
      lessonIds.push(lesson!.id);
    }
    createdModules.push({ id: mod!.id, lessonIds });
  }
  return { course: course!, modules: createdModules };
}

export async function createProduct(
  db: Db,
  input: {
    courseId: string;
    tier: ProductTier;
    kind?: "course_access" | "extension";
    accessMonths?: number | null;
    extensionMonths?: number | null;
    checkoutUrl?: string;
  },
) {
  const [product] = await db
    .insert(products)
    .values({
      slug: `produkt-${randomUUID().slice(0, 8)}`,
      title: "Testprodukt",
      tier: input.tier,
      kind: input.kind ?? "course_access",
      courseId: input.courseId,
      accessMonths: input.accessMonths ?? null,
      extensionMonths: input.extensionMonths ?? null,
      checkoutUrl: input.checkoutUrl,
      isPublished: true,
    })
    .returning();
  return product!;
}
