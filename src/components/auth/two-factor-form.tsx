"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { hardNavigate, safeNext } from "@/lib/safe-redirect";

export function TwoFactorForm() {
  const next = safeNext(useSearchParams().get("next"));
  const [useBackup, setUseBackup] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").replace(/\s/g, "");
    const trustDevice = form.get("trust") === "on";
    const { error: err } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });
    setPending(false);
    if (err) {
      setError("Der Code ist ungültig oder abgelaufen.");
      return;
    }
    hardNavigate(next);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField
        id="code"
        label={useBackup ? "Backup-Code" : "6-stelliger Code aus deiner Authenticator-App"}
      >
        <Input
          id="code"
          name="code"
          inputMode={useBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          required
          autoFocus
        />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="trust" className="size-4" />
        Diesem Gerät 30 Tage vertrauen
      </label>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending}>
        Bestätigen
      </Button>
      <button
        type="button"
        className="text-left text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        onClick={() => setUseBackup((v) => !v)}
      >
        {useBackup ? "Code aus der App verwenden" : "Stattdessen einen Backup-Code verwenden"}
      </button>
    </form>
  );
}
