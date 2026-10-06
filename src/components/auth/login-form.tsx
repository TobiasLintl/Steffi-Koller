"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { hardNavigate, safeNext } from "@/lib/safe-redirect";

type Mode = "password" | "magic";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>("password");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();

    if (mode === "magic") {
      const { error: err } = await authClient.signIn.magicLink({ email, callbackURL: next });
      setPending(false);
      if (err) {
        setError("Das hat leider nicht geklappt. Bitte versuche es gleich noch einmal.");
        return;
      }
      setMagicSent(true);
      return;
    }

    const password = String(form.get("password") ?? "");
    const { data, error: err } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (err) {
      setError(
        err.status === 403
          ? "Bitte bestätige zuerst deine E-Mail-Adresse. Wir haben dir dafür eine E-Mail geschickt."
          : "E-Mail-Adresse oder Passwort stimmen nicht.",
      );
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      router.push(`/anmelden/zwei-faktor?next=${encodeURIComponent(next)}`);
      return;
    }
    hardNavigate(next);
  }

  if (magicSent) {
    return (
      <Alert variant="success">
        Wenn zu dieser Adresse ein Konto existiert, haben wir dir einen Anmeldelink geschickt. Schau
        in dein Postfach – der Link ist 10 Minuten gültig.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Anmeldeart"
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      >
        {(
          [
            ["password", "Mit Passwort"],
            ["magic", "Mit Anmeldelink"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-md px-3 py-1.5 text-sm ${mode === value ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField id="email" label="E-Mail-Adresse">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </FormField>
        {mode === "password" ? (
          <FormField id="password" label="Passwort">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </FormField>
        ) : (
          <p className="text-sm text-muted-foreground">
            Wir schicken dir einen Link, mit dem du dich ohne Passwort anmeldest.
          </p>
        )}
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <Button type="submit" size="lg" disabled={pending}>
          {mode === "password" ? "Anmelden" : "Link senden"}
        </Button>
      </form>

      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <Link
          href="/passwort-vergessen"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Passwort vergessen?
        </Link>
        <span>
          Noch kein Konto?{" "}
          <Link href="/registrieren" className="text-foreground underline underline-offset-4">
            Jetzt registrieren
          </Link>
        </span>
      </div>
    </div>
  );
}
