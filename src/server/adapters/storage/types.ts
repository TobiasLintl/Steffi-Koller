/**
 * S3-compatible EU object storage adapter (e.g. Hetzner Object Storage).
 * Buckets are private; delivery only via short-lived signed URLs (default 10 min, MED-01/AK-08).
 * There is never a permanent public URL to course media (CLAUDE.md §5.4).
 */

export const DEFAULT_SIGNED_URL_TTL_SECONDS = 600;

export interface SignedUrlOptions {
  ttlSeconds?: number;
  /** "inline" unless the medium has download_allowed (MED-01). */
  disposition: "inline" | "attachment";
  fileName?: string;
  contentType?: string;
}

export interface UploadTarget {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StorageAdapter {
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
  getObject(key: string): Promise<Uint8Array | null>;
  headObject(key: string): Promise<{ size: number } | null>;
  getSignedDownloadUrl(key: string, options: SignedUrlOptions): Promise<string>;
  getSignedUploadUrl(key: string, contentType: string, ttlSeconds?: number): Promise<UploadTarget>;
  deleteObject(key: string): Promise<void>;
}

export function contentDisposition(
  disposition: "inline" | "attachment",
  fileName?: string,
): string {
  if (!fileName) return disposition;
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
