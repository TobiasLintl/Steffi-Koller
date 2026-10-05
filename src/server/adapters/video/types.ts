/**
 * Video streaming adapter (Bunny Stream default, Cloudflare Stream alternative – DECISION D-04).
 * Playback only via signed, time-limited URLs (MED-02); no permanent public URLs.
 */

export interface VideoAsset {
  /** Provider-side video id; stored on the lesson media record. */
  providerVideoId: string;
  status: "processing" | "ready" | "failed";
  durationSeconds?: number;
}

export interface SignedPlayback {
  /** Embed or HLS URL including token; adaptive bitrate (MED-03). */
  url: string;
  expiresAt: Date;
}

export interface UploadTarget {
  providerVideoId: string;
  /** Direct upload endpoint for the admin UI. */
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface VideoAdapter {
  createUpload(input: { title: string }): Promise<UploadTarget>;
  getAsset(providerVideoId: string): Promise<VideoAsset>;
  getSignedPlayback(providerVideoId: string, ttlSeconds: number): Promise<SignedPlayback>;
  uploadCaptions(providerVideoId: string, input: { language: string; vtt: string }): Promise<void>;
  deleteAsset(providerVideoId: string): Promise<void>;
}
