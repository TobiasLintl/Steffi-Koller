"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";

const TIERS = [
  ["free", "Kostenlos", { access: "", ext: "" }],
  ["small", "Klein", { access: "6", ext: "3" }],
  ["medium", "Mittel", { access: "6", ext: "3" }],
  ["large", "Groß", { access: "24", ext: "6" }],
  ["coaching", "Coaching", { access: "", ext: "" }],
] as const;

export interface ProductFormValues {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  tier: string;
  kind: string;
  courseId: string;
  accessMonths: string;
  extensionMonths: string;
  priceEur: string;
  priceChf: string;
  checkoutUrl: string;
  isPublished: boolean;
  sortOrder: string;
}

export function ProductForm({
  action,
  values,
  courses,
  submitLabel,
}: {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  values: ProductFormValues;
  courses: { id: string; title: string }[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [kind, setKind] = useState(values.kind);
  const [access, setAccess] = useState(values.accessMonths);
  const [ext, setExt] = useState(values.extensionMonths);
  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="title" label="Titel" error={err.title}>
          <Input id="title" name="title" defaultValue={values.title} required />
        </FormField>
        <FormField
          id="slug"
          label="Adresse (Slug)"
          hint="z. B. selbstliebe-kurs → /angebote/selbstliebe-kurs"
          error={err.slug}
        >
          <Input
            id="slug"
            name="slug"
            defaultValue={values.slug}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
        </FormField>
      </div>
      <FormField id="subtitle" label="Kurzbeschreibung" error={err.subtitle}>
        <Input id="subtitle" name="subtitle" defaultValue={values.subtitle} maxLength={300} />
      </FormField>
      <FormField
        id="description"
        label="Beschreibung"
        hint="Leerzeile = Absatz · „## “ = Zwischenüberschrift · „- “ = Aufzählung"
        error={err.description}
      >
        <Textarea id="description" name="description" defaultValue={values.description} rows={8} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="tier" label="Stufe" error={err.tier}>
          <Select
            id="tier"
            name="tier"
            defaultValue={values.tier}
            onChange={(e) => {
              const defaults = TIERS.find(([t]) => t === e.target.value)?.[2];
              // Defaults from CLAUDE.md §5.1 – stay editable per product.
              if (defaults) {
                setAccess(defaults.access);
                setExt(defaults.ext);
              }
            }}
          >
            {TIERS.map(([t, label]) => (
              <option key={t} value={t}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="kind" label="Art" error={err.kind}>
          <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="course_access">Kurszugang</option>
            <option value="extension">Verlängerung</option>
            <option value="coaching">Coaching</option>
          </Select>
        </FormField>
        <FormField id="courseId" label="Kurs" error={err.courseId}>
          <Select id="courseId" name="courseId" defaultValue={values.courseId}>
            <option value="">–</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {kind === "course_access" ? (
          <FormField
            id="accessMonths"
            label="Zugangsdauer in Monaten"
            hint="Leer = unbegrenzt (nur kostenlos)"
            error={err.accessMonths}
          >
            <Input
              id="accessMonths"
              name="accessMonths"
              type="number"
              min={1}
              max={120}
              value={access}
              onChange={(e) => setAccess(e.target.value)}
            />
          </FormField>
        ) : null}
        {kind === "extension" ? (
          <FormField
            id="extensionMonths"
            label="Verlängerung um Monate"
            error={err.extensionMonths}
          >
            <Input
              id="extensionMonths"
              name="extensionMonths"
              type="number"
              min={1}
              max={60}
              value={ext}
              onChange={(e) => setExt(e.target.value)}
            />
          </FormField>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="priceEur" label="Preis EUR (Anzeige)" error={err.priceEur}>
          <Input
            id="priceEur"
            name="priceEur"
            inputMode="decimal"
            defaultValue={values.priceEur}
            placeholder="49,00"
          />
        </FormField>
        <FormField id="priceChf" label="Preis CHF (Anzeige)" error={err.priceChf}>
          <Input
            id="priceChf"
            name="priceChf"
            inputMode="decimal"
            defaultValue={values.priceChf}
            placeholder="49.00"
          />
        </FormField>
      </div>
      <FormField
        id="checkoutUrl"
        label="Kauf-Link beim Reseller"
        hint="Checkout-Link aus CopeCart/Digistore24"
        error={err.checkoutUrl}
      >
        <Input
          id="checkoutUrl"
          name="checkoutUrl"
          type="url"
          defaultValue={values.checkoutUrl}
          placeholder="https://"
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="sortOrder" label="Sortierung" error={err.sortOrder}>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={values.sortOrder}
          />
        </FormField>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={values.isPublished}
            className="size-4"
          />{" "}
          auf der Website veröffentlichen
        </label>
      </div>
      {state.message ? (
        <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
