/**
 * Video streaming adapter (Bunny Stream default, Cloudflare Stream alternative – DECISION D-04).
 * Playback only via signed, time-limited URLs (MED-02) with adaptive bitrate (MED-03);
 * no permanent public URLs.
 */

export type VideoStatus = "processing" | "ready" | "failed";

export interface VideoUploadTarget {
  /** "tus": resumable upload protocol (Bunny), "put": single signed PUT (local driver). */
  protocol: "tus" | "put";
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export type VideoPlayback =
  | { type: "iframe"; url: string; expiresAt: Date }
  | {
      type: "file";
      url: string;
      expiresAt: Date;
      captions: { language: string; label: string; url: string }[];
    };

export interface VideoAdapter {
  readonly provider: "bunny" | "local";
  createVideo(input: { title: string }): Promise<{ providerVideoId: string }>;
  createUploadTarget(
    providerVideoId: string,
    file: { contentType: string; size: number; title: string },
  ): Promise<VideoUploadTarget>;
  getStatus(providerVideoId: string): Promise<{ status: VideoStatus; durationSeconds?: number }>;
  getPlayback(
    providerVideoId: string,
    options: {
      ttlSeconds: number;
      captions: { language: string; label: string; storageKey: string }[];
    },
  ): Promise<VideoPlayback>;
  uploadCaptions(
    providerVideoId: string,
    input: { language: string; label: string; vtt: string },
  ): Promise<void>;
  deleteVideo(providerVideoId: string): Promise<void>;
}
