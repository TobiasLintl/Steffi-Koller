import Link from "next/link";
import { notFound } from "next/navigation";

import { LessonMedia } from "@/components/account/lesson-media";
import { RichText } from "@/components/rich-text";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { videoAdapter } from "@/server/media/registry";
import { getLessonForUser } from "@/server/services/learning";
import { lessonMediaForPlayback } from "@/server/services/media";
import { toggleLessonCompleted } from "./actions";

export default async function LessonPage({
  params,
}: PageProps<"/konto/kurse/[slug]/lektion/[lessonId]">) {
  const { slug, lessonId } = await params;
  const user = await requireUser(`/konto/kurse/${slug}/lektion/${lessonId}`);
  const result = await getLessonForUser(db, user.id, slug, lessonId);

  // No entitlement → behave as if the lesson does not exist (AK-07).
  if (
    result.status === "not_found" ||
    (result.status === "forbidden" && result.reason === "no_entitlement")
  ) {
    notFound();
  }
  if (result.status === "forbidden") {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href={`/konto/kurse/${slug}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Zur Kursübersicht
        </Link>
        <Alert variant="warning">
          {result.reason === "locked"
            ? `Diese Lektion wird am ${formatDate(result.unlocksAt)} für dich freigeschaltet.`
            : result.reason === "expired"
              ? "Dein Zugang zu diesem Kurs ist abgelaufen."
              : "Dieser Zugang ist gesperrt."}
        </Alert>
      </div>
    );
  }

  const { view } = result;
  const mediaItems = await lessonMediaForPlayback(
    db,
    videoAdapter(),
    view.lesson.id,
    serverEnv().VIDEO_TOKEN_TTL_SECONDS,
  );
  const toggle = toggleLessonCompleted.bind(
    null,
    view.course.slug,
    view.lesson.id,
    !view.completed,
  );

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/konto/kurse/${view.course.slug}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {view.course.title}
        </Link>
        <p className="text-sm text-muted-foreground">{view.module.title}</p>
        <h1 className="text-2xl font-semibold">{view.lesson.title}</h1>
      </div>

      <LessonMedia items={mediaItems} courseSlug={view.course.slug} lessonId={view.lesson.id} />

      {view.lesson.body ? <RichText text={view.lesson.body} /> : null}

      {view.lesson.transcript ? (
        <details className="rounded-lg border bg-card p-4">
          <summary className="cursor-pointer font-medium">Transkript</summary>
          <div className="mt-3 text-sm">
            <RichText text={view.lesson.transcript} />
          </div>
        </details>
      ) : null}

      <form action={toggle}>
        <Button type="submit" variant={view.completed ? "outline" : "default"}>
          {view.completed ? "Als nicht erledigt markieren" : "Als erledigt markieren"}
        </Button>
      </form>

      <nav aria-label="Lektionsnavigation" className="flex justify-between gap-3 border-t pt-4">
        {view.previousLessonId ? (
          <Link
            href={`/konto/kurse/${view.course.slug}/lektion/${view.previousLessonId}`}
            className={buttonVariants({ variant: "ghost" })}
          >
            ← Vorherige
          </Link>
        ) : (
          <span />
        )}
        {view.nextLessonId ? (
          <Link
            href={`/konto/kurse/${view.course.slug}/lektion/${view.nextLessonId}`}
            className={buttonVariants({ variant: "ghost" })}
          >
            Nächste →
          </Link>
        ) : null}
      </nav>
    </article>
  );
}
