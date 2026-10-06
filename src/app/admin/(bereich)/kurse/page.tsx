import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listCoursesForAdmin } from "@/server/services/course-editor";

export const metadata = { title: "Kurse" };

export default async function CoursesPage() {
  const actor = await requirePermission("courses:read", "/admin/kurse");
  const rows = await listCoursesForAdmin(db);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Kurse</h1>
        {hasPermission(actor.role, "courses:write") ? (
          <Link href="/admin/kurse/neu" className={buttonVariants()}>
            Neuer Kurs
          </Link>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kurs</TableHead>
            <TableHead>Module</TableHead>
            <TableHead>Lektionen</TableHead>
            <TableHead>Teilnehmende</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ course, moduleCount, lessonCount, learnerCount }) => (
            <TableRow key={course.id}>
              <TableCell>
                <Link
                  href={`/admin/kurse/${course.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {course.title}
                </Link>
              </TableCell>
              <TableCell>{moduleCount}</TableCell>
              <TableCell>{lessonCount}</TableCell>
              <TableCell>{learnerCount}</TableCell>
              <TableCell>
                {course.isPublished ? (
                  <Badge>veröffentlicht</Badge>
                ) : (
                  <Badge variant="muted">Entwurf</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
