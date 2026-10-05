import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createLocalStorageAdapter, verifyLocal } from "@/server/adapters/storage";
import { createLocalVideoAdapter } from "@/server/adapters/video";
import { grantAccess } from "@/server/services/access";
import {
  addCaptions,
  assignMediaToLesson,
  authorizeMediaDelivery,
  deleteMedia,
  lessonMediaForPlayback,
  refreshMediaStatus,
  setDownloadAllowed,
  startMediaUpload,
} from "@/server/services/media";
import { closeTestDb, createUser, resetTables, testDb } from "../support/db";
import { createCourse } from "../support/fixtures";

const db = testDb();
const SECRET = "media-test-secret";
const storage = createLocalStorageAdapter({
  rootDir: mkdtempSync(path.join(tmpdir(), "sz-media-")),
  baseUrl: "http://app",
  signingSecret: SECRET,
});
const video = createLocalVideoAdapter(storage);
const deps = { storage, video };

function signed(url: string) {
  const p = Object.fromEntries(new URL(url).searchParams);
  return {
    params: {
      key: p.key!,
      op: p.op as "get",
      exp: Number(p.exp),
      disposition: p.disposition,
      name: p.name,
      type: p.type,
    },
    sig: p.sig!,
  };
}

async function uploadPdf(title = "Workbook") {
  const { mediaId, target } = await startMediaUpload(db, deps, {
    kind: "pdf",
    title,
    fileName: "workbook.pdf",
    contentType: "application/pdf",
    size: 4,
  });
  const key = signed(target.url).params.key;
  await storage.putObject(key, new Uint8Array([37, 80, 68, 70]), "application/pdf");
  expect(await refreshMediaStatus(db, deps, mediaId)).toBe("ready");
  return mediaId;
}

beforeEach(() => resetTables(db));
afterAll(closeTestDb);

describe("protected media delivery (AK-08, MED-01)", () => {
  it("delivers PDFs only to entitled users via 10-minute signed URLs, inline unless downloads are allowed", async () => {
    const buyer = await createUser(db);
    const stranger = await createUser(db);
    const { course, modules } = await createCourse(db);
    const lessonId = modules[0]!.lessonIds[0]!;
    await grantAccess(db, {
      userId: buyer.id,
      courseId: course.id,
      accessMonths: 6,
      source: "purchase",
    });
    const mediaId = await uploadPdf();
    await assignMediaToLesson(db, mediaId, lessonId);

    const request = { courseSlug: course.slug, lessonId, mediaId, download: true, ttlSeconds: 600 };
    expect(await authorizeMediaDelivery(db, storage, { ...request, userId: stranger.id })).toEqual({
      status: "not_found",
    });

    const now = Date.now();
    const result = await authorizeMediaDelivery(db, storage, { ...request, userId: buyer.id });
    expect(result.status).toBe("ok");
    const { params, sig } = signed((result as { url: string }).url);
    expect(params.disposition).toBe("inline"); // download not allowed → never an attachment
    expect(params.exp).toBeLessThanOrEqual(Math.floor(now / 1000) + 601);
    expect(verifyLocal(SECRET, params, sig)).toBe(true);
    expect(verifyLocal(SECRET, params, sig, (params.exp + 1) * 1000)).toBe(false); // no permanent URL

    await setDownloadAllowed(db, mediaId, true);
    const allowed = await authorizeMediaDelivery(db, storage, { ...request, userId: buyer.id });
    expect(signed((allowed as { url: string }).url).params.disposition).toBe("attachment");
  });

  it("does not deliver media of drip-locked lessons or media from other lessons", async () => {
    const buyer = await createUser(db);
    const { course, modules } = await createCourse(db, {
      modules: [{ unlockAfterDays: 0 }, { unlockAfterDays: 30 }],
    });
    await grantAccess(db, {
      userId: buyer.id,
      courseId: course.id,
      accessMonths: 24,
      source: "purchase",
    });
    const mediaId = await uploadPdf();
    await assignMediaToLesson(db, mediaId, modules[1]!.lessonIds[0]!);

    const locked = await authorizeMediaDelivery(db, storage, {
      userId: buyer.id,
      courseSlug: course.slug,
      lessonId: modules[1]!.lessonIds[0]!,
      mediaId,
      download: false,
      ttlSeconds: 600,
    });
    expect(locked).toEqual({ status: "not_found" });
    const wrongLesson = await authorizeMediaDelivery(db, storage, {
      userId: buyer.id,
      courseSlug: course.slug,
      lessonId: modules[0]!.lessonIds[0]!,
      mediaId,
      download: false,
      ttlSeconds: 600,
    });
    expect(wrongLesson).toEqual({ status: "not_found" });
  });

  it("stores no URLs for media in the database", async () => {
    const columns = await db.execute<{ column_name: string }>(sql`
      select column_name from information_schema.columns where table_name in ('media', 'media_captions', 'lesson_media')
    `);
    expect(columns.map((c) => c.column_name).filter((c) => c.includes("url"))).toEqual([]);
  });
});

describe("video playback and captions (MED-02, MED-05)", () => {
  it("returns signed playback with signed caption tracks", async () => {
    const { mediaId, target } = await startMediaUpload(db, deps, {
      kind: "video",
      title: "Willkommen",
      fileName: "w.mp4",
      contentType: "video/mp4",
      size: 3,
    });
    expect(target.protocol).toBe("put");
    await storage.putObject(signed(target.url).params.key, new Uint8Array([0, 0, 0]), "video/mp4");
    expect(await refreshMediaStatus(db, deps, mediaId)).toBe("ready");
    await addCaptions(db, deps, {
      mediaId,
      language: "de",
      label: "Deutsch",
      vtt: "WEBVTT\n\n00:00.000 --> 00:01.000\nHallo",
    });

    const { modules } = await createCourse(db);
    await assignMediaToLesson(db, mediaId, modules[0]!.lessonIds[0]!);
    const [item] = await lessonMediaForPlayback(db, video, modules[0]!.lessonIds[0]!, 3600);
    expect(item?.kind).toBe("video");
    if (item?.kind !== "video" || item.playback?.type !== "file")
      throw new Error("expected local playback");
    expect(item.playback.captions).toEqual([
      expect.objectContaining({ language: "de", label: "Deutsch" }),
    ]);
    expect(
      verifyLocal(SECRET, signed(item.playback.url).params, signed(item.playback.url).sig),
    ).toBe(true);
  });

  it("refuses to delete media that is still used in a lesson", async () => {
    const admin = await createUser(db, { role: "admin" });
    const mediaId = await uploadPdf();
    const { modules } = await createCourse(db);
    await assignMediaToLesson(db, mediaId, modules[0]!.lessonIds[0]!);
    await expect(deleteMedia(db, deps, { id: admin.id, role: "admin" }, mediaId)).rejects.toThrow();
  });
});
