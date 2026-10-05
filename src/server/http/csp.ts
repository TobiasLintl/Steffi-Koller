/**
 * Content Security Policy (CLAUDE.md §6). Scripts only with per-request nonce; external origins
 * limited to the configured media services (Bunny player, private S3 bucket) and – after
 * consent – an optional statistics script.
 */
export interface CspConfig {
  nonce: string;
  isDev: boolean;
  s3Endpoint?: string;
  s3Bucket?: string;
  statisticsScriptUrl?: string;
}

function origin(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function buildCsp(config: CspConfig): string {
  const s3 = origin(config.s3Endpoint);
  // Presigned URLs may be path-style (endpoint/bucket) or virtual-hosted (bucket.endpoint).
  const s3Hosted =
    s3 && config.s3Bucket
      ? `${new URL(s3).protocol}//${config.s3Bucket}.${new URL(s3).host}`
      : null;
  const storage = [s3, s3Hosted].filter(Boolean).join(" ");
  const stats = origin(config.statisticsScriptUrl);

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'nonce-${config.nonce}' 'strict-dynamic'${config.isDev ? " 'unsafe-eval'" : ""}${stats ? ` ${stats}` : ""}`,
    // Inline style attributes (progress bars) – styles cannot execute code.
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: blob:",
    "font-src": "'self'",
    "media-src": `'self' blob:${storage ? ` ${storage}` : ""}`,
    "frame-src": "https://iframe.mediadelivery.net",
    "connect-src": `'self' https://video.bunnycdn.com${storage ? ` ${storage}` : ""}${stats ? ` ${stats}` : ""}`,
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "frame-ancestors": "'none'",
  };
  const policy = Object.entries(directives).map(([k, v]) => `${k} ${v}`);
  if (!config.isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
