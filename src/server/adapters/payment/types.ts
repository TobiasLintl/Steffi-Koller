/**
 * Payment / reseller adapter (CopeCart, Digistore24 – DECISION D-02).
 * The reseller is merchant of record; we only receive and verify purchase notifications.
 * Domain code depends on these types only, never on a provider SDK (ARC-02).
 */

export const PAYMENT_PROVIDERS = ["copecart", "digistore24"] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number];

export type Currency = "EUR" | "CHF";

/** purchase/refund/chargeback are acted on; everything else is stored and ignored. */
export type PaymentEventType = "purchase" | "refund" | "chargeback" | "cancellation" | "unknown";

export interface BillingDetails {
  companyName?: string;
  vatId?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

/** Provider-neutral representation of one webhook/IPN notification. */
export interface NormalizedPaymentEvent {
  provider: PaymentProviderId;
  type: PaymentEventType;
  /** Raw provider event name, kept for unknown/unsupported types. */
  providerEventType: string;
  /** Unique per transaction (a refund has its own id at CopeCart). */
  transactionId: string;
  /** Order id shared by purchase and later refund/chargeback of the same item. */
  providerOrderId: string;
  providerProductId: string;
  buyerEmail: string;
  buyerFirstName?: string;
  buyerLastName?: string;
  /** ISO 3166-1 alpha-2 */
  buyerCountry?: string;
  /** Gross amount in minor units (cents/Rappen). */
  amountMinor?: number;
  currency?: Currency;
  customerType: "b2c" | "b2b";
  billing: BillingDetails;
  receiptReference?: string;
  paymentMethod?: string;
  isTest: boolean;
  occurredAt: Date;
}

export interface IncomingWebhookRequest {
  headers: Headers;
  rawBody: string;
}

export interface PaymentAdapter {
  readonly provider: PaymentProviderId;
  /** Verifies signature/passphrase. Must be called before parsing. */
  verify(request: IncomingWebhookRequest): boolean;
  /**
   * Maps a verified payload to a normalized event; unknown event types map to
   * `type: "unknown"`. Returns null for provider pings (connection tests).
   */
  parse(request: IncomingWebhookRequest): NormalizedPaymentEvent | null;
  /** Body the provider expects for a successful delivery. */
  readonly successResponse: string;
}

export class WebhookPayloadError extends Error {}

/** "300.25" / 300.25 → 30025 without floating point surprises. */
export function toMinorUnits(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const text = String(value).trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(text)) return undefined;
  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = text.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return negative ? -cents : cents;
}

export function normalizeCurrency(value: unknown): Currency | undefined {
  const c = String(value ?? "").toUpperCase();
  return c === "EUR" || c === "CHF" ? c : undefined;
}

export function cleanString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s === "" ? undefined : s;
}
