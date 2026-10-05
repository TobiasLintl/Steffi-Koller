"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { setLessonCompleted } from "@/server/services/learning";

export async function toggleLessonCompleted(
  courseSlug: string,
  lessonId: string,
  completed: boolean,
): Promise<void> {
  const user = await requireUser();
  await setLessonCompleted(db, user.id, courseSlug, lessonId, completed);
  revalidatePath(`/konto/kurse/${courseSlug}`);
  revalidatePath(`/konto/kurse/${courseSlug}/lektion/${lessonId}`);
}
