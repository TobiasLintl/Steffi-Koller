import type { Block } from "./blocks";

export interface PageDefault {
  slug: string;
  kind: "content" | "legal";
  title: string;
  metaDescription: string;
  blocks: Block[];
}

const LEGAL_PLACEHOLDER =
  "Text wird von Rechtstext-Dienst geliefert.\n\nDieser Abschnitt wird vor dem Start mit dem geprüften Text des gewählten Rechtstext-Dienstes befüllt (Adminbereich → Seiten & FAQ).";

/** Initial content. Everything is editable in the admin; nothing here is final copy. */
export const PAGE_DEFAULTS: PageDefault[] = [
  {
    slug: "start",
    kind: "content",
    title: "Seelenzeit",
    metaDescription:
      "Selbstlernkurse für mehr Ruhe, Klarheit und Verbindung mit dir selbst – in deinem Tempo, ohne Abo.",
    blocks: [
      {
        id: "hero",
        type: "hero",
        heading: "Zeit für dich. In deinem Tempo.",
        body: "Seelenzeit begleitet dich mit Selbstlernkursen, die du dann machst, wenn es für dich passt – ohne Abo, ohne Druck.",
        ctaLabel: "Angebote entdecken",
        ctaHref: "/angebote",
        imageId: "",
      },
      {
        id: "intro",
        type: "text",
        heading: "So funktioniert Seelenzeit",
        body: "- Du wählst einen Kurs, der zu dir passt.\n- Du kaufst ihn einmalig – es gibt kein Abo und keine automatische Verlängerung.\n- Du lernst in deinem persönlichen Bereich, so oft und so lange dein Zugang läuft.",
      },
      { id: "offers", type: "offers", heading: "Angebote" },
      {
        id: "gratis",
        type: "cta",
        heading: "Erst einmal reinschnuppern?",
        body: "Hol dir ein kostenloses Angebot und lerne Seelenzeit in Ruhe kennen.",
        label: "Zum Geschenk",
        href: "/gratis",
      },
      { id: "faq", type: "faq", heading: "Häufige Fragen", limit: 4 },
      {
        id: "newsletter",
        type: "newsletter",
        heading: "Post von Seelenzeit",
        body: "Gelegentliche Impulse und Neuigkeiten – nur, wenn du das möchtest.",
      },
    ],
  },
  {
    slug: "ueber-mich",
    kind: "content",
    title: "Über mich",
    metaDescription: "Wer hinter Seelenzeit steht und wie ich arbeite.",
    blocks: [
      {
        id: "about",
        type: "text",
        heading: "Über mich",
        body: "Hier stellst du dich vor: wer du bist, wie du arbeitest und was Seelenzeit für dich bedeutet.\n\n(Platzhalter – bitte im Adminbereich unter „Seiten & FAQ“ ersetzen.)",
      },
      {
        id: "cta",
        type: "cta",
        heading: "Lust, loszulegen?",
        body: "",
        label: "Angebote ansehen",
        href: "/angebote",
      },
    ],
  },
  {
    slug: "gratis",
    kind: "content",
    title: "Kostenlos für dich",
    metaDescription: "Ein kostenloses Geschenk von Seelenzeit zum Kennenlernen.",
    blocks: [
      {
        id: "intro",
        type: "text",
        heading: "Ein kleines Geschenk für dich",
        body: "Lerne Seelenzeit kennen – mit einem kostenlosen Angebot. Du brauchst nur ein kostenloses Konto, dann findest du es in deinem persönlichen Bereich.",
      },
      { id: "free", type: "free_products", heading: "Kostenlos für dich" },
      {
        id: "newsletter",
        type: "newsletter",
        heading: "Möchtest du auch Post?",
        body: "Melde dich zusätzlich für den Newsletter an. Das ist freiwillig und jederzeit abbestellbar.",
      },
    ],
  },
  ...(
    [
      ["impressum", "Impressum"],
      ["datenschutz", "Datenschutzerklärung"],
      ["agb", "Allgemeine Geschäftsbedingungen"],
      ["widerruf", "Widerrufsbelehrung"],
    ] as const
  ).map(([slug, title]) => ({
    slug,
    kind: "legal" as const,
    title,
    metaDescription: title,
    blocks: [{ id: "legal", type: "text" as const, heading: "", body: LEGAL_PLACEHOLDER }],
  })),
];

export function pageDefault(slug: string): PageDefault | undefined {
  return PAGE_DEFAULTS.find((p) => p.slug === slug);
}
