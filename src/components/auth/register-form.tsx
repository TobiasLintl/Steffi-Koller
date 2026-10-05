"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-redirect";

export function RegisterForm() {
  const next = safeNext(useSearchParams().get("next"));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("password2") ?? "")) {
      setError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }
    setPending(true);
    const { error: err } = await authClient.signUp.email({
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password,
      callbackURL: next,
    });
    setPending(false);
    if (err) {
      setError(
        err.code === "PASSWORD_TOO_SHORT"
          ? "Dein Passwort braucht mindestens 10 Zeichen."
          : "Die Registrierung hat nicht geklappt. Vielleicht gibt es schon ein Konto mit dieser Adresse – dann nutze „Passwort vergessen“.",
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Alert variant="success">
        Fast geschafft! Wir haben dir eine E-Mail geschickt. Bitte bestätige darin deine Adresse,
        dann ist dein Konto bereit.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField id="name" label="Vorname">
        <Input id="name" name="name" autoComplete="given-name" required maxLength={100} />
      </FormField>
      <FormField id="email" label="E-Mail-Adresse">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <FormField id="password" label="Passwort" hint="Mindestens 10 Zeichen.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </FormField>
      <FormField id="password2" label="Passwort wiederholen">
        <Input
          id="password2"
          name="password2"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </FormField>
      <p className="text-xs text-muted-foreground">
        Mit der Registrierung legst du ein kostenloses Konto an. Informationen zur Verarbeitung
        deiner Daten findest du in der{" "}
        <Link href="/datenschutz" className="underline underline-offset-4">
          Datenschutzerklärung
        </Link>
        .
      </p>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>
        Konto anlegen
      </Button>
      <p className="text-sm text-muted-foreground">
        Schon registriert?{" "}
        <Link href="/anmelden" className="text-foreground underline underline-offset-4">
          Zur Anmeldung
        </Link>
      </p>
    </form>
  );
}
