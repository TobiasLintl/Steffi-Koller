import { createHash } from "node:crypto";

import type { VideoAdapter, VideoStatus } from "./types";

/**
 * Bunny Stream (https://docs.bunny.net/reference/video):
 * - management API with `AccessKey` header (server side only)
 * - browser uploads via TUS with a pre-signed AuthorizationSignature
 *   = sha256(libraryId + apiKey + expiration + videoId)
 * - playback through the embed player with token authentication:
 *   token = sha256_hex(tokenSecurityKey + videoId + expires) – requires "Token authentication"
 *   and allowed referrers (hotlink protection, MED-04) to be enabled in the library settings.
 */
export interface BunnyConfig {
  libraryId: string;
  apiKey: string;
  tokenSecurityKey: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const API = "https://video.bunnycdn.com";
const EMBED = "https://iframe.mediadelivery.net/embed";

export function bunnyEmbedToken(tokenKey: string, videoId: string, expires: number): string {
  return createHash("sha256").update(`${tokenKey}${videoId}${expires}`).digest("hex");
}

export function bunnyTusSignature(
  libraryId: string,
  apiKey: string,
  expires: number,
  videoId: string,
): string {
  return createHash("sha256").update(`${libraryId}${apiKey}${expires}${videoId}`).digest("hex");
}

/** Bunny status codes: 0 created, 1 uploaded, 2 processing, 3 transcoding, 4 finished, 5 error, 6 upload failed. */
export function mapBunnyStatus(code: number): VideoStatus {
  if (code === 4) return "ready";
  if (code === 5 || code === 6) return "failed";
  return "processing";
}

export function createBunnyVideoAdapter(config: BunnyConfig): VideoAdapter {
  const doFetch = config.fetchImpl ?? fetch;
  const now = config.now ?? Date.now;
  const base = `${API}/library/${encodeURIComponent(config.libraryId)}/videos`;

  async function api(path: string, init: RequestInit = {}) {
    const response = await doFetch(`${base}${path}`, {
      ...init,
      headers: {
        AccessKey: config.apiKey,
        accept: "application/json",
        "content-type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok)
      throw new Error(
        `Bunny API ${init.method ?? "GET"} ${path} failed with HTTP ${response.status}`,
      );
    return response;
  }

  return {
    provider: "bunny",
    async createVideo({ title }) {
      const response = await api("", { method: "POST", body: JSON.stringify({ title }) });
      const body = (await response.json()) as { guid: string };
      return { providerVideoId: body.guid };
    },
    async createUploadTarget(videoId, file) {
      const expires = Math.floor(now() / 1000) + 6 * 3600;
      return {
        protocol: "tus",
        url: `${API}/tusupload`,
        headers: {
          AuthorizationSignature: bunnyTusSignature(
            config.libraryId,
            config.apiKey,
            expires,
            videoId,
          ),
          AuthorizationExpire: String(expires),
          VideoId: videoId,
          LibraryId: config.libraryId,
          "Upload-Metadata": `filetype ${Buffer.from(file.contentType).toString("base64")},title ${Buffer.from(file.title).toString("base64")}`,
        },
        expiresAt: new Date(expires * 1000),
      };
    },
    async getStatus(videoId) {
      const response = await api(`/${encodeURIComponent(videoId)}`);
      const body = (await response.json()) as { status: number; length?: number };
      return { status: mapBunnyStatus(body.status), durationSeconds: body.length };
    },
    async getPlayback(videoId, { ttlSeconds }) {
      const expires = Math.floor(now() / 1000) + ttlSeconds;
      const token = bunnyEmbedToken(config.tokenSecurityKey, videoId, expires);
      const url = `${EMBED}/${encodeURIComponent(config.libraryId)}/${encodeURIComponent(videoId)}?token=${token}&expires=${expires}&autoplay=false&preload=true&responsive=true`;
      return { type: "iframe", url, expiresAt: new Date(expires * 1000) };
    },
    async uploadCaptions(videoId, { language, label, vtt }) {
      await api(`/${encodeURIComponent(videoId)}/captions/${encodeURIComponent(language)}`, {
        method: "POST",
        body: JSON.stringify({
          srclang: language,
          label,
          captionsFile: Buffer.from(vtt, "utf8").toString("base64"),
        }),
      });
    },
    async deleteVideo(videoId) {
      await api(`/${encodeURIComponent(videoId)}`, { method: "DELETE" });
    },
  };
}
