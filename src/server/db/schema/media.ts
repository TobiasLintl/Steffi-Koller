import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { lessons } from "./catalog";

export const mediaKindEnum = pgEnum("media_kind", ["video", "audio", "pdf"]);
export const mediaStatusEnum = pgEnum("media_status", ["pending", "processing", "ready", "failed"]);

/**
 * Course media (CLAUDE.md §5.4). Only storage keys / provider ids are stored – never a URL.
 */
export const media = pgTable("media", {
  id: uuid().primaryKey().defaultRandom(),
  kind: mediaKindEnum().notNull(),
  title: text().notNull(),
  fileName: text(),
  mimeType: text(),
  sizeBytes: bigint({ mode: "number" }),
  /** MED-01: download permitted per medium. */
  downloadAllowed: boolean().notNull().default(false),
  /** pdf/audio: key in the private bucket. */
  storageKey: text(),
  /** video: provider ("bunny" | "local") and its video id. */
  videoProvider: text(),
  providerVideoId: text(),
  durationSeconds: integer(),
  status: mediaStatusEnum().notNull().default("pending"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** MED-05: subtitles per video (WebVTT), stored privately and pushed to the video provider. */
export const mediaCaptions = pgTable(
  "media_captions",
  {
    id: uuid().primaryKey().defaultRandom(),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    language: text().notNull(),
    label: text().notNull(),
    storageKey: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("media_captions_lang_idx").on(t.mediaId, t.language)],
);

export const lessonMedia = pgTable(
  "lesson_media",
  {
    lessonId: uuid()
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    position: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.lessonId, t.mediaId] }),
    index("lesson_media_media_idx").on(t.mediaId),
  ],
);
