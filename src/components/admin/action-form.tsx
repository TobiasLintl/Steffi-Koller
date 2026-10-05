"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

/** Form bound to a server action; shows the returned message and field errors. */
export function ActionForm({
  action,
  children,
  submitLabel,
  variant = "default",
  className,
  confirm,
}: {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submitLabel: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
  className?: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = Object.values(state.fieldErrors ?? {});

  return (
    <form
      action={formAction}
      className={cn("flex flex-col gap-3", className)}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state.message ? (
        <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>
      ) : null}
      {errors.length ? (
        <Alert variant="destructive">
          <ul className="list-disc pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" variant={variant} disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
