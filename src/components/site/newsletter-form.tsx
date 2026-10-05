"use client";

import Link from "next/link";
import { useActionState } from "react";

import { subscribeNewsletterAction } from "@/app/(public)/newsletter/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/action-state";

export function NewsletterForm({
  source = "website",
  consentText,
  defaultEmail,
}: {
  source?: string;
  consentText: string;
  defaultEmail?: string;
}) {
  const [state, action, pending] = useActionState(subscribeNewsletterAction, initialActionState);
  if (state.ok) return <Alert variant="success">{state.message}</Alert>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="source" value={source} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Deine E-Mail-Adresse"
          aria-label="E-Mail-Adresse für den Newsletter"
          defaultValue={defaultEmail}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          Anmelden
        </Button>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0" />
        <span>
          {consentText}{" "}
          <Link href="/datenschutz" className="underline underline-offset-4">
            Datenschutzerklärung
          </Link>
        </span>
      </label>
      {state.message ? <Alert variant="destructive">{state.message}</Alert> : null}
    </form>
  );
}
