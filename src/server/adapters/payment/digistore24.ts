import { createHash, timingSafeEqual } from "node:crypto";

import {
  cleanString,
  normalizeCurrency,
  toMinorUnits,
  WebhookPayloadError,
  type NormalizedPaymentEvent,
  type PaymentAdapter,
  type PaymentEventType,
} from "./types";

/**
 * Digistore24 IPN: form-encoded POST with `sha_sign` (SHA-512 over all non-empty parameters
 * sorted by key, each as "key=value" + passphrase, uppercase hex). Success response "OK".
 * Parameter names for VAT id/company must be confirmed in the reseller test (DECISION D-02);
 * the mapping below accepts the known variants.
 */
const EVENT_TYPES: Record<string, PaymentEventType> = {
  on_payment: "purchase",
  on_refund: "refund",
  on_chargeback: "chargeback",
  on_rebill_cancelled: "cancellation",
};

export function digistoreSignature(passphrase: string, params: Record<string, string>): string {
  const keys = Object.keys(params)
    .filter((k) => k !== "sha_sign" && k !== "SHASIGN")
    .sort();
  let source = "";
  for (const key of keys) {
    const value = params[key];
    if (value === undefined || value === "") continue;
    source += `${key}=${value}${passphrase}`;
  }
  return createHash("sha512").update(source, "utf8").digest("hex").toUpperCase();
}

function formParams(rawBody: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(rawBody));
}

function first(params: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = cleanString(params[key]);
    if (v) return v;
  }
  return undefined;
}

export function createDigistore24Adapter(config: { passphrase: string }): PaymentAdapter {
  return {
    provider: "digistore24",
    successResponse: "OK",

    verify({ rawBody }) {
      const params = formParams(rawBody);
      const given = params.sha_sign ?? params.SHASIGN;
      if (!given || !config.passphrase) return false;
      const expected = Buffer.from(digistoreSignature(config.passphrase, params));
      const actual = Buffer.from(given.toUpperCase());
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    },

    parse({ rawBody }): NormalizedPaymentEvent | null {
      const p = formParams(rawBody);
      const eventName = p.event ?? "unknown";
      if (eventName === "connection_test") return null;
      const transactionId = first(p, "transaction_id");
      const orderId = first(p, "order_id");
      const productId = first(p, "product_id");
      const email = first(p, "email", "address_email")?.toLowerCase();
      if (!transactionId || !orderId || !productId || !email) {
        throw new WebhookPayloadError(
          "Digistore24 payload misses transaction_id, order_id, product_id or email",
        );
      }
      const companyName = first(p, "address_company");
      const country = first(p, "address_country", "country")?.toUpperCase();
      const occurred = first(p, "transaction_date", "order_date_time", "order_date");

      return {
        provider: "digistore24",
        type: EVENT_TYPES[eventName] ?? "unknown",
        providerEventType: eventName,
        transactionId,
        providerOrderId: orderId,
        providerProductId: productId,
        buyerEmail: email,
        buyerFirstName: first(p, "address_first_name"),
        buyerLastName: first(p, "address_last_name"),
        buyerCountry: country,
        amountMinor: toMinorUnits(first(p, "amount", "transaction_amount")),
        currency: normalizeCurrency(p.currency),
        customerType: companyName ? "b2b" : "b2c",
        billing: {
          companyName,
          vatId: first(p, "address_vat_id", "address_tax_id", "vat_id", "buyer_vat_id")
            ?.toUpperCase()
            .replace(/\s+/g, ""),
          street: first(p, "address_street"),
          postalCode: first(p, "address_zipcode"),
          city: first(p, "address_city"),
          country,
        },
        receiptReference: first(p, "invoice_id", "order_id"),
        paymentMethod: first(p, "pay_method"),
        isTest: p.is_test === "Y" || p.transaction_type === "test",
        occurredAt:
          occurred && !Number.isNaN(Date.parse(occurred)) ? new Date(occurred) : new Date(),
      };
    },
  };
}
