export type MediaKind = "video" | "audio" | "pdf";

export const ALLOWED_MIME_TYPES: Record<MediaKind, readonly string[]> = {
  pdf: ["application/pdf"],
  audio: [
    "audio/mpeg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
  ],
  video: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"],
};

export const MAX_SIZE_BYTES: Record<MediaKind, number> = {
  pdf: 100 * 1024 * 1024,
  audio: 500 * 1024 * 1024,
  video: 10 * 1024 * 1024 * 1024,
};

export function validateUpload(kind: MediaKind, contentType: string, size: number): string | null {
  if (!ALLOWED_MIME_TYPES[kind].includes(contentType))
    return "Dieser Dateityp wird nicht unterstützt.";
  if (!Number.isFinite(size) || size <= 0) return "Die Datei ist leer.";
  if (size > MAX_SIZE_BYTES[kind]) return "Die Datei ist zu groß.";
  return null;
}

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
};

/** Opaque storage key – never derived from user input except the validated content type. */
export function storageKeyFor(kind: "pdf" | "audio", mediaId: string, contentType: string): string {
  return `${kind}/${mediaId}.${EXTENSIONS[contentType] ?? "bin"}`;
}

/** MED-01: an attachment (download) is only ever served when the medium allows it. */
export function deliveryDisposition(
  downloadAllowed: boolean,
  downloadRequested: boolean,
): "inline" | "attachment" {
  return downloadAllowed && downloadRequested ? "attachment" : "inline";
}

/** Minimal WebVTT sanity check for caption uploads (MED-05). */
export function isWebVtt(text: string): boolean {
  return /^﻿?WEBVTT(?:[ \t].*)?(?:\r?\n|$)/.test(text);
}
