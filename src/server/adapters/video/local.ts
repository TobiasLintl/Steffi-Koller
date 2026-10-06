import { randomUUID } from "node:crypto";

import type { StorageAdapter } from "@/server/adapters/storage";
import type { VideoAdapter } from "./types";

/**
 * Development driver: stores the uploaded file in (local) storage and plays it through a
 * short-lived signed URL. No transcoding/adaptive bitrate – production uses Bunny Stream.
 */
export function createLocalVideoAdapter(storage: StorageAdapter): VideoAdapter {
  const keyFor = (id: string) => `videos/${id}.mp4`;
  return {
    provider: "local",
    async createVideo() {
      return { providerVideoId: randomUUID() };
    },
    async createUploadTarget(videoId, file) {
      const target = await storage.getSignedUploadUrl(
        keyFor(videoId),
        file.contentType || "video/mp4",
      );
      return {
        protocol: "put",
        url: target.url,
        headers: target.headers,
        expiresAt: target.expiresAt,
      };
    },
    async getStatus(videoId) {
      return { status: (await storage.headObject(keyFor(videoId))) ? "ready" : "processing" };
    },
    async getPlayback(videoId, { ttlSeconds, captions }) {
      const url = await storage.getSignedDownloadUrl(keyFor(videoId), {
        disposition: "inline",
        ttlSeconds,
        contentType: "video/mp4",
      });
      const signedCaptions = await Promise.all(
        captions.map(async (c) => ({
          language: c.language,
          label: c.label,
          url: await storage.getSignedDownloadUrl(c.storageKey, {
            disposition: "inline",
            ttlSeconds,
            contentType: "text/vtt",
          }),
        })),
      );
      return {
        type: "file",
        url,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        captions: signedCaptions,
      };
    },
    async uploadCaptions() {
      // Local player reads captions directly from storage.
    },
    async deleteVideo(videoId) {
      await storage.deleteObject(keyFor(videoId));
    },
  };
}
