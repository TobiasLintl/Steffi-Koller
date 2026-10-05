import { ActionForm } from "@/components/admin/action-form";
import { MediaUploader } from "@/components/admin/media-uploader";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listLessonsForSelect, listMediaForAdmin } from "@/server/services/media";
import {
  assignAction,
  captionsAction,
  deleteAction,
  finishUploadAction,
  refreshStatusAction,
  startUploadAction,
  toggleDownloadAction,
  unassignAction,
} from "./actions";

export const metadata = { title: "Medien" };

const KIND = { video: "Video", audio: "Audio", pdf: "PDF" } as const;
const STATUS = {
  pending: "Upload ausstehend",
  processing: "wird verarbeitet",
  ready: "bereit",
  failed: "fehlgeschlagen",
} as const;

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}

export default async function MediaPage() {
  await requirePermission("media:write", "/admin/medien");
  const [items, lessonOptions] = await Promise.all([
    listMediaForAdmin(db),
    listLessonsForSelect(db),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Medien</h1>
        <p className="text-sm text-muted-foreground">
          Dateien liegen privat. Kundinnen erhalten nur zeitlich begrenzte Links – und nur für
          Lektionen, die sie gerade öffnen dürfen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Neues Medium hochladen</CardTitle>
        </CardHeader>
        <MediaUploader startUpload={startUploadAction} finishUpload={finishUploadAction} />
      </Card>

      <ul className="flex flex-col gap-4">
        {items.map((m) => (
          <li key={m.id}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{m.title}</CardTitle>
                  <Badge variant="outline">{KIND[m.kind]}</Badge>
                  <Badge
                    variant={
                      m.status === "ready"
                        ? "default"
                        : m.status === "failed"
                          ? "destructive"
                          : "muted"
                    }
                  >
                    {STATUS[m.status]}
                  </Badge>
                </div>
                <CardDescription>
                  {m.fileName} {formatSize(m.sizeBytes)} · hochgeladen {formatDate(m.createdAt)}
                  {m.durationSeconds ? ` · ${Math.round(m.durationSeconds / 60)} Min.` : ""}
                </CardDescription>
              </CardHeader>

              <div className="flex flex-wrap items-center gap-3">
                <form action={toggleDownloadAction.bind(null, m.id, !m.downloadAllowed)}>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    aria-pressed={m.downloadAllowed}
                  >
                    Download {m.downloadAllowed ? "erlaubt – sperren" : "gesperrt – erlauben"}
                  </Button>
                </form>
                {m.status !== "ready" ? (
                  <form action={refreshStatusAction.bind(null, m.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Status aktualisieren
                    </Button>
                  </form>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Verwendet in</p>
                {m.usedIn.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keiner Lektion zugeordnet.</p>
                ) : null}
                <ul className="flex flex-col gap-1 text-sm">
                  {m.usedIn.map((u) => (
                    <li key={u.lessonId} className="flex items-center gap-2">
                      {u.courseTitle} › {u.lessonTitle}
                      <form action={unassignAction.bind(null, m.id, u.lessonId)}>
                        <Button type="submit" variant="ghost" size="sm">
                          Entfernen
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
                <ActionForm
                  action={assignAction.bind(null, m.id)}
                  submitLabel="Zuordnen"
                  variant="outline"
                  className="max-w-xl"
                >
                  <FormField id={`lesson-${m.id}`} label="Lektion zuordnen">
                    <Select id={`lesson-${m.id}`} name="lessonId" defaultValue="">
                      <option value="" disabled>
                        Lektion wählen
                      </option>
                      {lessonOptions.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.courseTitle} › {l.moduleTitle} › {l.title}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </ActionForm>
              </div>

              {m.kind === "video" ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Untertitel</p>
                  <p className="text-sm text-muted-foreground">
                    {m.captions.length
                      ? m.captions.map((c) => `${c.label} (${c.language})`).join(", ")
                      : "Noch keine Untertitel."}
                  </p>
                  <ActionForm
                    action={captionsAction.bind(null, m.id)}
                    submitLabel="Untertitel hochladen"
                    variant="outline"
                    className="max-w-xl"
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      <FormField id={`lang-${m.id}`} label="Sprache">
                        <Input
                          id={`lang-${m.id}`}
                          name="language"
                          defaultValue="de"
                          maxLength={2}
                          required
                        />
                      </FormField>
                      <FormField id={`label-${m.id}`} label="Bezeichnung">
                        <Input id={`label-${m.id}`} name="label" defaultValue="Deutsch" required />
                      </FormField>
                      <FormField id={`vtt-${m.id}`} label="Datei (.vtt)">
                        <Input
                          id={`vtt-${m.id}`}
                          name="file"
                          type="file"
                          accept=".vtt,text/vtt"
                          required
                        />
                      </FormField>
                    </div>
                  </ActionForm>
                </div>
              ) : null}

              {m.usedIn.length === 0 ? (
                <ActionForm
                  action={deleteAction.bind(null, m.id)}
                  submitLabel="Medium löschen"
                  variant="destructive"
                  confirm="Medium endgültig löschen?"
                />
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
