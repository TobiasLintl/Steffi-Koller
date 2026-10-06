"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { isWebVtt } from "@/server/domain/media/rules";
import { storage, videoAdapter } from "@/server/media/registry";
import {
  addCaptions,
  assignMediaToLesson,
  deleteMedia,
  MediaError,
  refreshMediaStatus,
  setDownloadAllowed,
  startMediaUpload,
  unassignMedia,
} from "@/server/services/media";

const deps = () => ({ storage: storage(), video: videoAdapter() });

const startSchema = z.object({
  kind: z.enum(["video", "audio", "pdf"]),
  title: z.string().trim().min(1).max(200),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().max(100),
  size: z.number().int().positive(),
});

export type StartUploadResult =
  | {
      ok: true;
      mediaId: string;
      target: { protocol: "tus" | "put"; url: string; headers: Record<string, string> };
    }
  | { ok: false; message: string };

export async function startUploadAction(
  input: z.infer<typeof startSchema>,
): Promise<StartUploadResult> {
  await requirePermission("media:write", "/admin/medien");
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ungültige Angaben." };
  try {
    const { mediaId, target } = await startMediaUpload(db, deps(), parsed.data);
    return {
      ok: true,
      mediaId,
      target: { protocol: target.protocol, url: target.url, headers: target.headers },
    };
  } catch (error) {
    if (error instanceof MediaError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function finishUploadAction(mediaId: string): Promise<string> {
  await requirePermission("media:write", "/admin/medien");
  const status = await refreshMediaStatus(db, deps(), z.uuid().parse(mediaId));
  revalidatePath("/admin/medien");
  return status;
}

export async function refreshStatusAction(mediaId: string): Promise<void> {
  await requirePermission("media:write", "/admin/medien");
  await finishUploadAction(mediaId);
}

export async function toggleDownloadAction(mediaId: string, allowed: boolean): Promise<void> {
  await requirePermission("media:write", "/admin/medien");
  await setDownloadAllowed(db, z.uuid().parse(mediaId), allowed);
  revalidatePath("/admin/medien");
}

export async function captionsAction(
  mediaId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("media:write", "/admin/medien");
  const file = formData.get("file");
  const language = z
    .string()
    .regex(/^[a-z]{2}$/)
    .safeParse(formData.get("language"));
  const label = z.string().trim().min(1).max(50).safeParse(formData.get("label"));
  if (!(file instanceof File) || !language.success || !label.success)
    return { ok: false, message: "Bitte Sprache, Bezeichnung und Datei angeben." };
  if (file.size > 2 * 1024 * 1024)
    return { ok: false, message: "Die Untertiteldatei ist zu groß." };
  const vtt = await file.text();
  if (!isWebVtt(vtt)) return { ok: false, message: "Bitte eine WebVTT-Datei (.vtt) hochladen." };
  try {
    await addCaptions(db, deps(), {
      mediaId: z.uuid().parse(mediaId),
      language: language.data,
      label: label.data,
      vtt,
    });
  } catch (error) {
    if (error instanceof MediaError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/admin/medien");
  return { ok: true, message: "Untertitel gespeichert." };
}

export async function assignAction(
  mediaId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("media:write", "/admin/medien");
  const lessonId = z.uuid().safeParse(formData.get("lessonId"));
  if (!lessonId.success) return { ok: false, message: "Bitte eine Lektion wählen." };
  await assignMediaToLesson(db, z.uuid().parse(mediaId), lessonId.data);
  revalidatePath("/admin/medien");
  return { ok: true, message: "Zugeordnet." };
}

export async function unassignAction(mediaId: string, lessonId: string): Promise<void> {
  await requirePermission("media:write", "/admin/medien");
  await unassignMedia(db, z.uuid().parse(mediaId), z.uuid().parse(lessonId));
  revalidatePath("/admin/medien");
}

export async function deleteAction(mediaId: string): Promise<ActionState> {
  const actor = await requirePermission("media:write", "/admin/medien");
  try {
    await deleteMedia(db, deps(), actor, z.uuid().parse(mediaId));
  } catch (error) {
    if (error instanceof MediaError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/admin/medien");
  return { ok: true, message: "Gelöscht." };
}
