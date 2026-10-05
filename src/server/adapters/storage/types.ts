/**
 * S3-compatible EU object storage adapter (e.g. Hetzner Object Storage).
 * Buckets are private; delivery only via short-lived signed URLs (default 10 min).
 */

export const DEFAULT_SIGNED_URL_TTL_SECONDS = 600;

export interface SignedUrlOptions {
  ttlSeconds?: number;
  /** "inline" unless the medium has download_allowed (MED-01). */
  disposition: "inline" | "attachment";
  fileName?: string;
  contentType?: string;
}

export interface StorageAdapter {
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
  getSignedDownloadUrl(key: string, options: SignedUrlOptions): Promise<string>;
  getSignedUploadUrl(key: string, contentType: string, ttlSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}
