import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CourseFields({
  values,
}: {
  values?: { slug: string; title: string; description: string; isPublished: boolean };
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="course-title" label="Titel">
          <Input id="course-title" name="title" defaultValue={values?.title} required />
        </FormField>
        <FormField id="course-slug" label="Adresse (Slug)" hint="erscheint in /konto/kurse/…">
          <Input
            id="course-slug"
            name="slug"
            defaultValue={values?.slug}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
        </FormField>
      </div>
      <FormField id="course-description" label="Beschreibung">
        <Textarea
          id="course-description"
          name="description"
          defaultValue={values?.description}
          rows={3}
        />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={values?.isPublished ?? false}
          className="size-4"
        />{" "}
        veröffentlicht
      </label>
    </>
  );
}
