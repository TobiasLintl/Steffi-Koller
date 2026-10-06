import { CheckCircle2, Circle, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CourseStateBadge } from "@/components/account/course-state-badge";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getCourseOutline } from "@/server/services/learning";

export default async function CoursePage({ params }: PageProps<"/konto/kurse/[slug]">) {
  const { slug } = await params;
  const user = await requireUser(`/konto/kurse/${slug}`);
  const outline = await getCourseOutline(db, user.id, slug);
  if (!outline) notFound();
  const active = outline.state === "active";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/konto" className="text-sm text-muted-foreground hover:underline">
          ← Meine Kurse
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{outline.course.title}</h1>
          <CourseStateBadge state={outline.state} />
        </div>
        {outline.course.description ? (
          <p className="text-muted-foreground">{outline.course.description}</p>
        ) : null}
      </div>

      {outline.state === "expired" ? (
        <Alert variant="warning">
          <p>
            Dein Zugang ist am {formatDate(outline.expiresAt)} abgelaufen. Die Inhalte sind
            gesperrt, bis du verlängerst.
          </p>
          {outline.extensionCheckoutUrl ? (
            <a
              href={outline.extensionCheckoutUrl}
              className={`${buttonVariants({ size: "sm" })} mt-3`}
              rel="noopener"
            >
              Zugang verlängern
            </a>
          ) : null}
        </Alert>
      ) : null}
      {outline.state === "revoked" ? (
        <Alert variant="destructive">
          Dieser Zugang ist gesperrt. Bei Fragen melde dich gern beim Kundenservice.
        </Alert>
      ) : null}

      <ol className="flex flex-col gap-4">
        {outline.modules.map((mod, i) => {
          const open = active && mod.unlocked;
          return (
            <li key={mod.id} className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  Modul {i + 1}: {mod.title}
                </h2>
                {active && !mod.unlocked ? (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Lock className="size-4" aria-hidden /> ab {formatDate(mod.unlocksAt)}
                  </span>
                ) : null}
              </div>
              {mod.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{mod.description}</p>
              ) : null}
              <ul className="mt-3 flex flex-col">
                {mod.lessons.map((lesson) => (
                  <li key={lesson.id} className="border-t first:border-t-0">
                    {open ? (
                      <Link
                        href={`/konto/kurse/${outline.course.slug}/lektion/${lesson.id}`}
                        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-accent"
                      >
                        {lesson.completed ? (
                          <CheckCircle2
                            className="size-5 shrink-0 text-primary"
                            aria-label="erledigt"
                          />
                        ) : (
                          <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <span className="flex-1">{lesson.title}</span>
                        {lesson.durationMinutes ? (
                          <span className="text-xs text-muted-foreground">
                            {lesson.durationMinutes} Min.
                          </span>
                        ) : null}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-3 py-2.5 text-muted-foreground">
                        <Lock className="size-4 shrink-0" aria-hidden />
                        {lesson.title}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
