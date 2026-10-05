/**
 * Payment / reseller adapter (CopeCart, Digistore24 – DECISION D-02).
 * The reseller is merchant of record; we only receive and verify purchase notifications.
 * Domain code depends on these types only, never on a provider SDK (ARC-02).
 */

export type PaymentProviderId = "copecart" | "digistore24";

export type Currency = "EUR" | "CHF";

export type PaymentEventType = "purchase" | "refund" | "chargeback" | "cancellation" | "unknown";

export interface B2bDetails {
  companyName: string;
  vatId?: string;
  billingAddress: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
}

/** Provider-neutral representation of one webhook/IPN notification. */
export interface NormalizedPaymentEvent {
  provider: PaymentProviderId;
  type: PaymentEventType;
  /** Raw provider event name, kept for unknown/unsupported types. */
  providerEventType: string;
  transactionId: string;
  providerProductId: string;
  buyerEmail: string;
  buyerFirstName?: string;
  buyerLastName?: string;
  buyerCountry: string;
  /** Gross amount in minor units (cents/Rappen). */
  amountMinor: number;
  currency: Currency;
  b2b?: B2bDetails;
  receiptReference?: string;
  occurredAt: Date;
}

export interface IncomingWebhookRequest {
  headers: Headers;
  rawBody: string;
}

export interface PaymentAdapter {
  readonly provider: PaymentProviderId;
  /** Verifies signature/passphrase. Must be called before parsing. */
  verify(request: IncomingWebhookRequest): Promise<boolean>;
  /** Maps a verified payload to a normalized event; unknown types map to `type: "unknown"`. */
  parse(request: IncomingWebhookRequest): Promise<NormalizedPaymentEvent>;
}
