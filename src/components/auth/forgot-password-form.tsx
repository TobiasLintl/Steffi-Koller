"use client";

import { useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    await authClient.requestPasswordReset({ email, redirectTo: "/passwort-zuruecksetzen" });
    setPending(false);
    // Same answer whether or not the account exists (no account enumeration).
    setDone(true);
  }

  if (done) {
    return (
      <Alert variant="success">
        Wenn es ein Konto mit dieser Adresse gibt, haben wir dir einen Link zum Zurücksetzen
        geschickt.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField id="email" label="E-Mail-Adresse">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <Button type="submit" size="lg" disabled={pending}>
        Link anfordern
      </Button>
    </form>
  );
}
