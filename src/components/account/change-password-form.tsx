"use client";

import { useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function ChangePasswordForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("newPassword2") ?? "")) {
      setMessage({ ok: false, text: "Die neuen Passwörter stimmen nicht überein." });
      return;
    }
    setPending(true);
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (error) {
      setMessage({
        ok: false,
        text: "Das aktuelle Passwort stimmt nicht oder das neue ist zu kurz.",
      });
      return;
    }
    formEl.reset();
    setMessage({
      ok: true,
      text: "Dein Passwort wurde geändert. Andere Geräte wurden abgemeldet.",
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-3">
      <FormField id="currentPassword" label="Aktuelles Passwort">
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      <FormField id="newPassword" label="Neues Passwort" hint="Mindestens 10 Zeichen.">
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </FormField>
      <FormField id="newPassword2" label="Neues Passwort wiederholen">
        <Input
          id="newPassword2"
          name="newPassword2"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </FormField>
      {message ? (
        <Alert variant={message.ok ? "success" : "destructive"}>{message.text}</Alert>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          Passwort ändern
        </Button>
      </div>
    </form>
  );
}
