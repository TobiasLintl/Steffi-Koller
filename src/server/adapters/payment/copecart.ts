import { createHmac, timingSafeEqual } from "node:crypto";

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
 * CopeCart IPN (documentation v1.6.7, 2025-06-17):
 * - JSON body via POST, header `X-Copecart-Signature` = base64(HMAC-SHA256(secret, raw body))
 * - success requires the response body "OK"; failed calls are retried 10× within 3 hours
 * - one IPN per transaction; refunds/chargebacks carry their own transaction_id and the
 *   order_id + product_id of the original sale
 */
const EVENT_TYPES: Record<string, PaymentEventType> = {
  "payment.made": "purchase",
  "payment.refunded": "refund",
  "payment.charged_back": "chargeback",
  "payment.recurring.cancelled": "cancellation",
};

export function copecartSignature(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
}

export function createCopeCartAdapter(config: { secret: string }): PaymentAdapter {
  return {
    provider: "copecart",
    successResponse: "OK",

    verify({ headers, rawBody }) {
      const given = headers.get("x-copecart-signature");
      if (!given || !config.secret) return false;
      const expected = Buffer.from(copecartSignature(config.secret, rawBody));
      const actual = Buffer.from(given.trim());
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    },

    parse({ rawBody }): NormalizedPaymentEvent {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        throw new WebhookPayloadError("CopeCart payload is not valid JSON");
      }
      const eventName = cleanString(data.event_type) ?? "unknown";
      const transactionId = cleanString(data.transaction_id);
      const orderId = cleanString(data.order_id);
      const productId = cleanString(data.product_id);
      const email = cleanString(data.buyer_email)?.toLowerCase();
      if (!transactionId || !orderId || !productId || !email) {
        throw new WebhookPayloadError(
          "CopeCart payload misses transaction_id, order_id, product_id or buyer_email",
        );
      }
      const companyName = cleanString(data.buyer_company_name);
      const paymentStatus = cleanString(data.payment_status) ?? "";
      const occurred =
        cleanString(data.transaction_processed_at) ?? cleanString(data.transaction_date);

      return {
        provider: "copecart",
        type: EVENT_TYPES[eventName] ?? "unknown",
        providerEventType: eventName,
        transactionId,
        providerOrderId: orderId,
        providerProductId: productId,
        buyerEmail: email,
        buyerFirstName: cleanString(data.buyer_firstname),
        buyerLastName: cleanString(data.buyer_lastname),
        buyerCountry: cleanString(data.buyer_country_code)?.toUpperCase(),
        amountMinor: toMinorUnits(data.transaction_amount),
        currency: normalizeCurrency(data.transaction_currency),
        customerType: companyName ? "b2b" : "b2c",
        billing: {
          companyName,
          vatId: cleanString(data.buyer_vat_number)?.toUpperCase().replace(/\s+/g, ""),
          street: cleanString(data.buyer_address),
          postalCode: cleanString(data.buyer_zipcode),
          city: cleanString(data.buyer_city),
          country: cleanString(data.buyer_country_code)?.toUpperCase(),
        },
        // CopeCart issues the invoice; its order id is the reference to the receipt.
        receiptReference: orderId,
        paymentMethod: cleanString(data.payment_method),
        isTest:
          data.test_payment === true ||
          data.test_payment === "true" ||
          paymentStatus.startsWith("test_"),
        occurredAt:
          occurred && !Number.isNaN(Date.parse(occurred)) ? new Date(occurred) : new Date(),
      };
    },
  };
}
