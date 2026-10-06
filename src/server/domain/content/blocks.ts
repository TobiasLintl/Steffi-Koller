import { z } from "zod";

/** CMS block types. Text is plain text (paragraphs, "## " headings, "- " lists) – no raw HTML. */
const id = z.string().min(1).max(64);
const short = z.string().max(200);
const long = z.string().max(20_000);
const href = z
  .string()
  .max(500)
  .refine(
    (v) => v === "" || v.startsWith("/") || /^https:\/\//.test(v),
    "Link muss mit / oder https:// beginnen",
  );

export const blockSchema = z.discriminatedUnion("type", [
  z.object({
    id,
    type: z.literal("hero"),
    heading: short,
    body: long,
    ctaLabel: short.default(""),
    ctaHref: href.default(""),
    imageId: z.string().default(""),
  }),
  z.object({ id, type: z.literal("text"), heading: short.default(""), body: long }),
  z.object({
    id,
    type: z.literal("image"),
    imageId: z.string(),
    alt: short.default(""),
    caption: short.default(""),
  }),
  z.object({
    id,
    type: z.literal("cta"),
    heading: short,
    body: long.default(""),
    label: short,
    href,
  }),
  z.object({ id, type: z.literal("offers"), heading: short.default("Angebote") }),
  z.object({
    id,
    type: z.literal("faq"),
    heading: short.default("Häufige Fragen"),
    limit: z.number().int().min(1).max(20).default(4),
  }),
  z.object({
    id,
    type: z.literal("newsletter"),
    heading: short.default("Newsletter"),
    body: long.default(""),
  }),
  z.object({ id, type: z.literal("free_products"), heading: short.default("Kostenlos für dich") }),
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Großer Einstieg",
  text: "Textabschnitt",
  image: "Bild",
  cta: "Handlungsaufforderung",
  offers: "Angebotsliste",
  faq: "FAQ-Auszug",
  newsletter: "Newsletter-Anmeldung",
  free_products: "Kostenlose Angebote",
};

/** Tolerant parsing: invalid blocks are dropped instead of breaking the page. */
export function parseBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const parsed = blockSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
}

export function newBlock(type: BlockType, blockId: string): Block {
  const defaults: Record<BlockType, unknown> = {
    hero: { heading: "Überschrift", body: "" },
    text: { heading: "", body: "Dein Text" },
    image: { imageId: "" },
    cta: { heading: "Überschrift", label: "Mehr erfahren", href: "/angebote" },
    offers: {},
    faq: {},
    newsletter: {},
    free_products: {},
  };
  return blockSchema.parse({ id: blockId, type, ...(defaults[type] as object) });
}

export function moveBlock(blocks: Block[], blockId: string, direction: -1 | 1): Block[] {
  const index = blocks.findIndex((b) => b.id === blockId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= blocks.length) return blocks;
  const next = [...blocks];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
