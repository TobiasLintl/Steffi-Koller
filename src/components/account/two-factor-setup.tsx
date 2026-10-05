"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

type Step =
  | { name: "password" }
  | { name: "verify"; qr: string; secret: string; backupCodes: string[] }
  | { name: "done"; backupCodes: string[] };

export function TwoFactorSetup({
  enabled,
  redirectTo,
  allowDisable = true,
}: {
  enabled: boolean;
  redirectTo?: string;
  allowDisable?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "password" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const { data, error: err } = await authClient.twoFactor.enable({ password });
    setPending(false);
    if (err || !data || data.method !== "totp") {
      setError("Das Passwort stimmt nicht.");
      return;
    }
    const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
    const qr = await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 });
    setStep({ name: "verify", qr, secret, backupCodes: data.backupCodes });
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.name !== "verify") return;
    setError(null);
    setPending(true);
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    const { error: err } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (err) {
      setError("Der Code passt nicht. Prüfe die Uhrzeit deines Handys und versuche es erneut.");
      return;
    }
    setStep({ name: "done", backupCodes: step.backupCodes });
  }

  async function disable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const { error: err } = await authClient.twoFactor.disable({ password });
    setPending(false);
    if (err) {
      setError("Das Passwort stimmt nicht.");
      return;
    }
    router.refresh();
  }

  if (enabled && step.name === "password") {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">Die Zwei-Faktor-Anmeldung ist aktiv.</Alert>
        {allowDisable ? (
          <form onSubmit={disable} className="flex max-w-sm flex-col gap-3">
            <FormField id="disable-password" label="Zum Deaktivieren Passwort eingeben">
              <Input
                id="disable-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </FormField>
            {error ? <Alert variant="destructive">{error}</Alert> : null}
            <div>
              <Button type="submit" variant="outline" disabled={pending}>
                Zwei-Faktor-Anmeldung deaktivieren
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    );
  }

  if (step.name === "done") {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">Geschafft – die Zwei-Faktor-Anmeldung ist jetzt aktiv.</Alert>
        <BackupCodes codes={step.backupCodes} />
        <div>
          <Button
            onClick={() => {
              if (redirectTo) router.push(redirectTo);
              router.refresh();
            }}
          >
            Weiter
          </Button>
        </div>
      </div>
    );
  }

  if (step.name === "verify") {
    return (
      <div className="flex flex-col gap-5">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Öffne deine Authenticator-App (z. B. Aegis, 2FAS, Google Authenticator).</li>
          <li>Scanne den QR-Code oder gib den Schlüssel manuell ein.</li>
          <li>Gib den 6-stelligen Code aus der App ein.</li>
        </ol>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise */}
        <img
          src={step.qr}
          alt="QR-Code für die Authenticator-App"
          width={220}
          height={220}
          className="rounded-md border bg-white p-2"
        />
        <p className="text-sm">
          Schlüssel: <code className="rounded bg-muted px-1.5 py-0.5 break-all">{step.secret}</code>
        </p>
        <form onSubmit={verify} className="flex max-w-sm flex-col gap-3">
          <FormField id="code" label="Code aus der App">
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </FormField>
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <div>
            <Button type="submit" disabled={pending}>
              Aktivieren
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={start} className="flex max-w-sm flex-col gap-3">
      <FormField id="enable-password" label="Dein Passwort">
        <Input
          id="enable-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div>
        <Button type="submit" disabled={pending}>
          Zwei-Faktor-Anmeldung einrichten
        </Button>
      </div>
    </form>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Deine Backup-Codes</p>
      <p className="text-sm text-muted-foreground">
        Bewahre diese Codes sicher auf. Jeder Code funktioniert einmal, falls du dein Handy nicht
        zur Hand hast.
      </p>
      <ul className="grid max-w-sm grid-cols-2 gap-1 rounded-md bg-muted p-3 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}
