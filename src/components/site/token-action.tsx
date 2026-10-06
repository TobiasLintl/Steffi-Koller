"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/lib/action-state";

/** One-click confirmation via POST – links in e-mails are never acted on by a plain GET. */
export function TokenAction({
  action,
  label,
}: {
  action: (prev: ActionState) => Promise<ActionState>;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  if (state.message)
    return <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>;
  return (
    <form action={formAction}>
      <Button type="submit" size="lg" disabled={pending}>
        {label}
      </Button>
    </form>
  );
}
