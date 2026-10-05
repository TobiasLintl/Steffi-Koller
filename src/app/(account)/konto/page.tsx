import type { Metadata } from "next";
import Link from "next/link";

import { CourseStateBadge } from "@/components/account/course-state-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { listMyCourses } from "@/server/services/learning";

export const metadata: Metadata = { title: "Meine Kurse" };

export default async function MyCoursesPage() {
  const user = await requireUser();
  const courses = await listMyCourses(db, user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Hallo {user.name}!</h1>
        <p className="text-muted-foreground">Schön, dass du dir Zeit für dich nimmst.</p>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Noch keine Kurse</CardTitle>
            <CardDescription>
              Sobald du einen Kurs gekauft oder ein kostenloses Angebot gewählt hast, findest du ihn
              hier.
            </CardDescription>
          </CardHeader>
          <div>
            <Link href="/angebote" className={buttonVariants()}>
              Angebote ansehen
            </Link>
          </div>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {courses.map((c) => {
            const percent = c.totalLessons
              ? Math.round((c.completedLessons / c.totalLessons) * 100)
              : 0;
            return (
              <li key={c.courseId}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle>{c.title}</CardTitle>
                      <CourseStateBadge state={c.state} />
                    </div>
                    <CardDescription>
                      {c.state === "active"
                        ? c.expiresAt
                          ? `Zugang bis ${formatDate(c.expiresAt)}`
                          : "Unbegrenzter Zugang"
                        : c.state === "expired"
                          ? `Abgelaufen am ${formatDate(c.expiresAt)} – verlängern, um weiterzulernen`
                          : "Dieser Zugang ist gesperrt. Bei Fragen melde dich gern beim Kundenservice."}
                    </CardDescription>
                  </CardHeader>
                  {c.state === "active" ? (
                    <div className="flex flex-col gap-2">
                      <div
                        className="h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Fortschritt ${c.title}`}
                      >
                        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.completedLessons} von {c.totalLessons} Lektionen erledigt
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-auto flex flex-wrap gap-2">
                    {c.state === "active" ? (
                      <Link href={`/konto/kurse/${c.slug}`} className={buttonVariants()}>
                        {c.completedLessons > 0 ? "Weiterlernen" : "Kurs starten"}
                      </Link>
                    ) : (
                      <Link
                        href={`/konto/kurse/${c.slug}`}
                        className={buttonVariants({ variant: "outline" })}
                      >
                        Kursübersicht
                      </Link>
                    )}
                    {c.state === "expired" && c.extensionCheckoutUrl ? (
                      <a href={c.extensionCheckoutUrl} className={buttonVariants()} rel="noopener">
                        Zugang verlängern
                      </a>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
