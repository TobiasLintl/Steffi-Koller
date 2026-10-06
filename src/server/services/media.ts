import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { writeAudit } from "@/server/audit/log";
import type { StorageAdapter } from "@/server/adapters/storage";
import type { VideoAdapter, VideoPlayback } from "@/server/adapters/video";
import { courses, lessonMedia, lessons, media, mediaCaptions, modules } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import {
  deliveryDisposition,
  storageKeyFor,
  validateUpload,
  type MediaKind,
} from "@/server/domain/media/rules";
import type { StaffActor } from "./access";
import { checkLessonAccess } from "./learning";

export type LessonMediaItem =
  | {
      id: string;
      kind: "video";
      title: string;
      playback: VideoPlayback | null;
      durationSeconds: number | null;
    }
  | { id: string; kind: "audio" | "pdf"; title: string; downloadAllowed: boolean };

/** Media of a lesson for rendering. Call only after the lesson access check passed. */
export async function lessonMediaForPlayback(
  db: DbExecutor,
  video: VideoAdapter,
  lessonId: string,
  videoTtlSeconds: number,
): Promise<LessonMediaItem[]> {
  const rows = await db
    .select({ media })
    .from(lessonMedia)
    .innerJoin(media, eq(media.id, lessonMedia.mediaId))
    .where(and(eq(lessonMedia.lessonId, lessonId), eq(media.status, "ready")))
    .orderBy(asc(lessonMedia.position));
  const videoIds = rows.filter((r) => r.media.kind === "video").map((r) => r.media.id);
  const captions = videoIds.length
    ? await db.select().from(mediaCaptions).where(inArray(mediaCaptions.mediaId, videoIds))
    : [];

  return Promise.all(
    rows.map(async ({ media: m }): Promise<LessonMediaItem> => {
      if (m.kind === "video") {
        const playback = m.providerVideoId
          ? await video
              .getPlayback(m.providerVideoId, {
                ttlSeconds: videoTtlSeconds,
                captions: captions
                  .filter((c) => c.mediaId === m.id)
                  .map((c) => ({ language: c.language, label: c.label, storageKey: c.storageKey })),
              })
              .catch(() => null)
          : null;
        return {
          id: m.id,
          kind: "video",
          title: m.title,
          playback,
          durationSeconds: m.durationSeconds,
        };
      }
      return { id: m.id, kind: m.kind, title: m.title, downloadAllowed: m.downloadAllowed };
    }),
  );
}

export type MediaAccess = { status: "ok"; url: string } | { status: "not_found" };

/**
 * AK-08: returns a short-lived signed URL for a PDF/audio of a lesson the user may open right now.
 * Anything else (no entitlement, drip-locked, not part of the lesson) is indistinguishable
 * from "not found".
 */
export async function authorizeMediaDelivery(
  db: DbExecutor,
  storage: StorageAdapter,
  input: {
    userId: string;
    courseSlug: string;
    lessonId: string;
    mediaId: string;
    download: boolean;
    ttlSeconds: number;
    now?: Date;
  },
): Promise<MediaAccess> {
  if (!/^[0-9a-f-]{36}$/i.test(input.mediaId)) return { status: "not_found" };
  const access = await checkLessonAccess(
    db,
    input.userId,
    input.courseSlug,
    input.lessonId,
    input.now,
  );
  if (access.status !== "ok") return { status: "not_found" };

  const [row] = await db
    .select({ media })
    .from(lessonMedia)
    .innerJoin(media, eq(media.id, lessonMedia.mediaId))
    .where(and(eq(lessonMedia.lessonId, input.lessonId), eq(lessonMedia.mediaId, input.mediaId)));
  const m = row?.media;
  if (!m || m.status !== "ready" || !m.storageKey || m.kind === "video")
    return { status: "not_found" };

  const url = await storage.getSignedDownloadUrl(m.storageKey, {
    disposition: deliveryDisposition(m.downloadAllowed, input.download),
    fileName: m.fileName ?? undefined,
    contentType: m.mimeType ?? undefined,
    ttlSeconds: input.ttlSeconds,
  });
  return { status: "ok", url };
}

/* ------------------------------- Admin ------------------------------- */

export async function listMediaForAdmin(db: DbExecutor) {
  const rows = await db.select().from(media).orderBy(desc(media.createdAt));
  const usage = await db
    .select({
      mediaId: lessonMedia.mediaId,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      courseTitle: courses.title,
    })
    .from(lessonMedia)
    .innerJoin(lessons, eq(lessons.id, lessonMedia.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId));
  const captions = await db.select().from(mediaCaptions);
  return rows.map((m) => ({
    ...m,
    usedIn: usage.filter((u) => u.mediaId === m.id),
    captions: captions.filter((c) => c.mediaId === m.id),
  }));
}

export async function listLessonsForSelect(db: DbExecutor) {
  return db
    .select({
      id: lessons.id,
      title: lessons.title,
      moduleTitle: modules.title,
      courseTitle: courses.title,
    })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .orderBy(asc(courses.title), asc(modules.position), asc(lessons.position));
}

export class MediaError extends Error {}

export async function startMediaUpload(
  db: DbExecutor,
  deps: { storage: StorageAdapter; video: VideoAdapter },
  input: { kind: MediaKind; title: string; fileName: string; contentType: string; size: number },
) {
  const problem = validateUpload(input.kind, input.contentType, input.size);
  if (problem) throw new MediaError(problem);

  const [row] = await db
    .insert(media)
    .values({
      kind: input.kind,
      title: input.title,
      fileName: input.fileName,
      mimeType: input.contentType,
      sizeBytes: input.size,
    })
    .returning();
  if (input.kind === "video") {
    const { providerVideoId } = await deps.video.createVideo({ title: input.title });
    await db
      .update(media)
      .set({ videoProvider: deps.video.provider, providerVideoId })
      .where(eq(media.id, row!.id));
    const target = await deps.video.createUploadTarget(providerVideoId, {
      contentType: input.contentType,
      size: input.size,
      title: input.title,
    });
    return { mediaId: row!.id, target };
  }
  const storageKey = storageKeyFor(input.kind, row!.id, input.contentType);
  await db.update(media).set({ storageKey }).where(eq(media.id, row!.id));
  const target = await deps.storage.getSignedUploadUrl(storageKey, input.contentType);
  return {
    mediaId: row!.id,
    target: {
      protocol: "put" as const,
      url: target.url,
      headers: target.headers,
      expiresAt: target.expiresAt,
    },
  };
}

/** Called after the browser finished uploading; also used to refresh the video processing state. */
export async function refreshMediaStatus(
  db: DbExecutor,
  deps: { storage: StorageAdapter; video: VideoAdapter },
  mediaId: string,
) {
  const [m] = await db.select().from(media).where(eq(media.id, mediaId));
  if (!m) throw new MediaError("Medium nicht gefunden.");
  if (m.kind === "video" && m.providerVideoId) {
    const s = await deps.video.getStatus(m.providerVideoId);
    await db
      .update(media)
      .set({
        status: s.status,
        durationSeconds: s.durationSeconds ?? m.durationSeconds,
        updatedAt: new Date(),
      })
      .where(eq(media.id, mediaId));
    return s.status;
  }
  const head = m.storageKey ? await deps.storage.headObject(m.storageKey) : null;
  const status = head && head.size > 0 ? "ready" : "failed";
  await db
    .update(media)
    .set({ status, sizeBytes: head?.size ?? m.sizeBytes, updatedAt: new Date() })
    .where(eq(media.id, mediaId));
  return status;
}

export async function setDownloadAllowed(
  db: DbExecutor,
  mediaId: string,
  allowed: boolean,
): Promise<void> {
  await db
    .update(media)
    .set({ downloadAllowed: allowed, updatedAt: new Date() })
    .where(eq(media.id, mediaId));
}

export async function addCaptions(
  db: DbExecutor,
  deps: { storage: StorageAdapter; video: VideoAdapter },
  input: { mediaId: string; language: string; label: string; vtt: string },
): Promise<void> {
  const [m] = await db.select().from(media).where(eq(media.id, input.mediaId));
  if (!m || m.kind !== "video") throw new MediaError("Untertitel gibt es nur für Videos.");
  const storageKey = `captions/${m.id}.${input.language}.vtt`;
  await deps.storage.putObject(storageKey, new TextEncoder().encode(input.vtt), "text/vtt");
  if (m.providerVideoId) await deps.video.uploadCaptions(m.providerVideoId, input);
  await db
    .insert(mediaCaptions)
    .values({ mediaId: m.id, language: input.language, label: input.label, storageKey })
    .onConflictDoUpdate({
      target: [mediaCaptions.mediaId, mediaCaptions.language],
      set: { label: input.label, storageKey },
    });
}

export async function assignMediaToLesson(
  db: DbExecutor,
  mediaId: string,
  lessonId: string,
): Promise<void> {
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${lessonMedia.position}) + 1, 0)::int` })
    .from(lessonMedia)
    .where(eq(lessonMedia.lessonId, lessonId));
  await db.insert(lessonMedia).values({ mediaId, lessonId, position: next }).onConflictDoNothing();
}

export async function unassignMedia(
  db: DbExecutor,
  mediaId: string,
  lessonId: string,
): Promise<void> {
  await db
    .delete(lessonMedia)
    .where(and(eq(lessonMedia.mediaId, mediaId), eq(lessonMedia.lessonId, lessonId)));
}

export async function deleteMedia(
  db: DbExecutor,
  deps: { storage: StorageAdapter; video: VideoAdapter },
  actor: StaffActor,
  mediaId: string,
): Promise<void> {
  const [m] = await db.select().from(media).where(eq(media.id, mediaId));
  if (!m) return;
  const [used] = await db
    .select({ lessonId: lessonMedia.lessonId })
    .from(lessonMedia)
    .where(eq(lessonMedia.mediaId, mediaId))
    .limit(1);
  if (used) throw new MediaError("Das Medium ist noch Lektionen zugeordnet.");
  const captions = await db.select().from(mediaCaptions).where(eq(mediaCaptions.mediaId, mediaId));
  for (const c of captions) await deps.storage.deleteObject(c.storageKey);
  if (m.storageKey) await deps.storage.deleteObject(m.storageKey);
  if (m.kind === "video" && m.providerVideoId)
    await deps.video.deleteVideo(m.providerVideoId).catch(() => undefined);
  await db.transaction(async (tx) => {
    await tx.delete(media).where(eq(media.id, mediaId));
    await writeAudit(tx, {
      action: "media.deleted",
      actorUserId: actor.id,
      actorRole: actor.role,
      targetType: "media",
      targetId: mediaId,
      metadata: { kind: m.kind, title: m.title },
    });
  });
}
