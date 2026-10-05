"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";

export function ContactForm({
  action,
}: {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const err = state.fieldErrors ?? {};

  if (state.ok) return <Alert variant="success">{state.message}</Alert>;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="name" label="Name" error={err.name}>
          <Input id="name" name="name" autoComplete="name" required maxLength={100} />
        </FormField>
        <FormField id="email" label="E-Mail-Adresse" error={err.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </FormField>
      </div>
      <FormField id="subject" label="Betreff" error={err.subject}>
        <Input id="subject" name="subject" required maxLength={200} />
      </FormField>
      <FormField id="message" label="Deine Nachricht" error={err.message}>
        <Textarea id="message" name="message" required rows={6} minLength={10} maxLength={5000} />
      </FormField>
      <p className="text-xs text-muted-foreground">
        Wir verwenden deine Angaben nur, um deine Anfrage zu beantworten. Mehr dazu in der{" "}
        <Link href="/datenschutz" className="underline underline-offset-4">
          Datenschutzerklärung
        </Link>
        .
      </p>
      {state.message ? <Alert variant="destructive">{state.message}</Alert> : null}
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          Nachricht senden
        </Button>
      </div>
    </form>
  );
}
