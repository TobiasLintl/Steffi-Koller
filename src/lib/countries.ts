/** Target markets DE + CH, EU technically prepared (CLAUDE.md §1). ISO 3166-1 alpha-2. */
export const COUNTRIES = [
  ["DE", "Deutschland"],
  ["CH", "Schweiz"],
  ["AT", "Österreich"],
  ["LI", "Liechtenstein"],
  ["BE", "Belgien"],
  ["BG", "Bulgarien"],
  ["DK", "Dänemark"],
  ["EE", "Estland"],
  ["FI", "Finnland"],
  ["FR", "Frankreich"],
  ["GR", "Griechenland"],
  ["IE", "Irland"],
  ["IT", "Italien"],
  ["HR", "Kroatien"],
  ["LV", "Lettland"],
  ["LT", "Litauen"],
  ["LU", "Luxemburg"],
  ["MT", "Malta"],
  ["NL", "Niederlande"],
  ["PL", "Polen"],
  ["PT", "Portugal"],
  ["RO", "Rumänien"],
  ["SE", "Schweden"],
  ["SK", "Slowakei"],
  ["SI", "Slowenien"],
  ["ES", "Spanien"],
  ["CZ", "Tschechien"],
  ["HU", "Ungarn"],
  ["CY", "Zypern"],
] as const;

export type CountryCode = (typeof COUNTRIES)[number][0];

export const COUNTRY_CODES = COUNTRIES.map(([code]) => code) as [CountryCode, ...CountryCode[]];

export function countryName(code: string | null | undefined): string {
  return COUNTRIES.find(([c]) => c === code)?.[1] ?? code ?? "–";
}
