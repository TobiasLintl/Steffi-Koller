import Link from "next/link";

import { ActionForm } from "@/components/admin/action-form";
import { CourseFields } from "@/components/admin/course-fields";
import { Card } from "@/components/ui/card";
import { requirePermission } from "@/server/auth/session";
import { createCourseAction } from "../actions";

export const metadata = { title: "Neuer Kurs" };

export default async function NewCoursePage() {
  await requirePermission("courses:write", "/admin/kurse/neu");
  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/kurse" className="text-sm text-muted-foreground hover:underline">
        ← Kurse
      </Link>
      <h1 className="text-2xl font-semibold">Neuer Kurs</h1>
      <Card>
        <ActionForm action={createCourseAction} submitLabel="Anlegen" className="max-w-2xl">
          <CourseFields />
        </ActionForm>
      </Card>
    </div>
  );
}
