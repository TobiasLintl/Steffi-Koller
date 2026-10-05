"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token || params.get("error")) {
    return (
      <Alert variant="destructive">
        Dieser Link ist ungültig oder abgelaufen.{" "}
        <Link href="/passwort-vergessen" className="underline">
          Neuen Link anfordern
        </Link>
      </Alert>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password") ?? "");
    if (newPassword !== String(form.get("password2") ?? "")) {
      setError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }
    setPending(true);
    const { error: err } = await authClient.resetPassword({ newPassword, token: token ?? "" });
    setPending(false);
    if (err) {
      setError("Das hat nicht geklappt. Der Link ist vielleicht abgelaufen.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Alert variant="success">
        Dein neues Passwort ist gespeichert.{" "}
        <Link href="/anmelden" className="underline">
          Jetzt anmelden
        </Link>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField id="password" label="Neues Passwort" hint="Mindestens 10 Zeichen.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </FormField>
      <FormField id="password2" label="Neues Passwort wiederholen">
        <Input
          id="password2"
          name="password2"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </FormField>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>
        Passwort speichern
      </Button>
    </form>
  );
}
