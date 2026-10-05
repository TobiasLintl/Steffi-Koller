/** Only allow same-site relative redirect targets (prevents open redirects). */
export function safeNext(value: string | null | undefined, fallback = "/konto"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}

/**
 * Full page load after sign-in: the client router cache may still hold redirects that were
 * prefetched while signed out.
 */
export function hardNavigate(path: string): void {
  window.location.assign(path);
}
