"use client";

/** Re-opens the consent banner (implemented in M5). */
export function CookieSettingsLink() {
  return (
    <button
      type="button"
      className="hover:text-foreground"
      onClick={() => window.dispatchEvent(new Event("seelenzeit:open-consent"))}
    >
      Cookie-Einstellungen
    </button>
  );
}
