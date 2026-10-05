"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { COUNTRIES } from "@/lib/countries";

export interface ProfileValues {
  customerType: "b2c" | "b2b";
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  companyName: string | null;
  vatId: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
}

export function ProfileForm({
  values,
  action,
}: {
  values: ProfileValues;
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [type, setType] = useState(values.customerType);
  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Ich kaufe als</legend>
        <div className="flex gap-6 text-sm">
          {(
            [
              ["b2c", "Privatperson"],
              ["b2b", "Unternehmen"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="customerType"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="size-4"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="firstName" label="Vorname" error={err.firstName}>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={values.firstName ?? ""}
            autoComplete="given-name"
          />
        </FormField>
        <FormField id="lastName" label="Nachname" error={err.lastName}>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={values.lastName ?? ""}
            autoComplete="family-name"
          />
        </FormField>
      </div>

      {type === "b2b" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="companyName" label="Firma" error={err.companyName}>
            <Input
              id="companyName"
              name="companyName"
              defaultValue={values.companyName ?? ""}
              autoComplete="organization"
            />
          </FormField>
          <FormField id="vatId" label="USt-IdNr. / UID (optional)" error={err.vatId}>
            <Input id="vatId" name="vatId" defaultValue={values.vatId ?? ""} />
          </FormField>
        </div>
      ) : null}

      <FormField id="street" label="Straße und Hausnummer" error={err.street}>
        <Input
          id="street"
          name="street"
          defaultValue={values.street ?? ""}
          autoComplete="street-address"
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="postalCode" label="PLZ" error={err.postalCode}>
          <Input
            id="postalCode"
            name="postalCode"
            defaultValue={values.postalCode ?? ""}
            autoComplete="postal-code"
          />
        </FormField>
        <div className="sm:col-span-2">
          <FormField id="city" label="Ort" error={err.city}>
            <Input
              id="city"
              name="city"
              defaultValue={values.city ?? ""}
              autoComplete="address-level2"
            />
          </FormField>
        </div>
      </div>
      <FormField id="country" label="Land" error={err.country}>
        <Select id="country" name="country" defaultValue={values.country ?? ""}>
          <option value="">Bitte wählen</option>
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </Select>
      </FormField>

      {state.message ? (
        <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          Speichern
        </Button>
      </div>
    </form>
  );
}
