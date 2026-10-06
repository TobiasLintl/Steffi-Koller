"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const COOKIE = "sz_consent";
const VERSION = "2026-10-01"; // keep in sync with CONSENT_POLICY_VERSION

export interface ClientConsent {
  statistics: boolean;
  marketing: boolean;
}

export function readConsent(): ClientConsent | null {
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as {
      v?: string;
      statistics?: boolean;
      marketing?: boolean;
    };
    if (value.v !== VERSION) return null;
    return { statistics: Boolean(value.statistics), marketing: Boolean(value.marketing) };
  } catch {
    return null;
  }
}

export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [statistics, setStatistics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const current = readConsent();
    // Reading the cookie is only possible after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!current) setOpen(true);
    const reopen = () => {
      const c = readConsent();
      setStatistics(c?.statistics ?? false);
      setMarketing(c?.marketing ?? false);
      setDetails(true);
      setOpen(true);
    };
    window.addEventListener("seelenzeit:open-consent", reopen);
    return () => window.removeEventListener("seelenzeit:open-consent", reopen);
  }, []);

  async function save(choice: ClientConsent) {
    await fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(choice),
    });
    setOpen(false);
    window.dispatchEvent(new Event("seelenzeit:consent-changed"));
  }

  if (!open) return null;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background shadow-lg sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:max-w-2xl sm:rounded-xl sm:border"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id="consent-title" className="font-semibold">
          Cookies & Datenschutz
        </h2>
        <p className="text-sm text-muted-foreground">
          Wir verwenden nur technisch notwendige Cookies, z. B. für deine Anmeldung. Statistik- oder
          Marketingdienste laden wir ausschließlich, wenn du zustimmst. Deine Wahl kannst du
          jederzeit über „Cookie-Einstellungen“ im Fußbereich ändern. Mehr in der{" "}
          <Link href="/datenschutz" className="underline underline-offset-4">
            Datenschutzerklärung
          </Link>
          .
        </p>
        {details ? (
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="sr-only">Kategorien</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked disabled className="size-4" /> Notwendig (immer aktiv)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={statistics}
                onChange={(e) => setStatistics(e.target.checked)}
                className="size-4"
              />{" "}
              Statistik
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="size-4"
              />{" "}
              Marketing
            </label>
          </fieldset>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button onClick={() => save({ statistics: true, marketing: true })}>
            Alle akzeptieren
          </Button>
          <Button variant="outline" onClick={() => save({ statistics: false, marketing: false })}>
            Nur notwendige
          </Button>
          {details ? (
            <Button variant="secondary" onClick={() => save({ statistics, marketing })}>
              Auswahl speichern
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setDetails(true)}>
              Einstellungen
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
