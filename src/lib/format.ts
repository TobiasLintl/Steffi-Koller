const TZ = "Europe/Berlin";

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: TZ }).format(
    new Date(date),
  );
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  }).format(new Date(date));
}

export function formatMoney(
  minor: number | null | undefined,
  currency: "EUR" | "CHF" | string,
): string {
  if (minor === null || minor === undefined) return "–";
  return new Intl.NumberFormat(currency === "CHF" ? "de-CH" : "de-DE", {
    style: "currency",
    currency,
  }).format(minor / 100);
}
