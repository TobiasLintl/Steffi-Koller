import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Block } from "@/server/domain/content/blocks";

/** Edit fields per CMS block type (server component, used inside an ActionForm). */
export function BlockFields({ block }: { block: Block }) {
  const id = (name: string) => `${block.id}-${name}`;
  const text = (name: string, label: string, value: string, hint?: string) => (
    <FormField id={id(name)} label={label} hint={hint}>
      <Input id={id(name)} name={name} defaultValue={value} />
    </FormField>
  );
  const area = (name: string, label: string, value: string, rows = 5) => (
    <FormField
      id={id(name)}
      label={label}
      hint="Leerzeile = neuer Absatz · „## “ = Zwischenüberschrift · „- “ = Aufzählung"
    >
      <Textarea id={id(name)} name={name} defaultValue={value} rows={rows} />
    </FormField>
  );

  switch (block.type) {
    case "hero":
      return (
        <>
          {text("heading", "Überschrift", block.heading)}
          {area("body", "Text", block.body, 3)}
          <div className="grid gap-3 sm:grid-cols-2">
            {text("ctaLabel", "Button-Text", block.ctaLabel)}
            {text("ctaHref", "Button-Link", block.ctaHref, "z. B. /angebote")}
          </div>
          {text("imageId", "Bild-ID (optional)", block.imageId)}
        </>
      );
    case "text":
      return (
        <>
          {text("heading", "Überschrift (optional)", block.heading)}
          {area("body", "Text", block.body, 8)}
        </>
      );
    case "image":
      return (
        <>
          {text("imageId", "Bild-ID", block.imageId)}
          {text("alt", "Bildbeschreibung", block.alt)}
          {text("caption", "Bildunterschrift", block.caption)}
        </>
      );
    case "cta":
      return (
        <>
          {text("heading", "Überschrift", block.heading)}
          {area("body", "Text", block.body, 3)}
          <div className="grid gap-3 sm:grid-cols-2">
            {text("label", "Button-Text", block.label)}
            {text("href", "Button-Link", block.href)}
          </div>
        </>
      );
    case "faq":
      return (
        <>
          {text("heading", "Überschrift", block.heading)}
          <FormField id={id("limit")} label="Anzahl Fragen">
            <Input
              id={id("limit")}
              name="limit"
              type="number"
              min={1}
              max={20}
              defaultValue={block.limit}
            />
          </FormField>
        </>
      );
    case "newsletter":
      return (
        <>
          {text("heading", "Überschrift", block.heading)}
          {area("body", "Text", block.body, 3)}
        </>
      );
    case "offers":
    case "free_products":
      return text("heading", "Überschrift", block.heading);
  }
}
