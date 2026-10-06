import { describe, expect, it } from "vitest";

import { copecartSignature, createCopeCartAdapter } from "@/server/adapters/payment/copecart";
import {
  createDigistore24Adapter,
  digistoreSignature,
} from "@/server/adapters/payment/digistore24";
import { toMinorUnits } from "@/server/adapters/payment/types";

const SECRET = "test-secret";

function ccRequest(body: object, signature?: string) {
  const rawBody = JSON.stringify(body);
  const headers = new Headers({
    "x-copecart-signature": signature ?? copecartSignature(SECRET, rawBody),
  });
  return { headers, rawBody };
}

describe("CopeCart adapter", () => {
  const adapter = createCopeCartAdapter({ secret: SECRET });
  const sale = {
    event_type: "payment.made",
    transaction_id: "53703f91bb7ab490",
    order_id: "7clYUvQI",
    product_id: "2df15941",
    buyer_email: "Max.Mueller@Example.test",
    buyer_firstname: "Max",
    buyer_lastname: "Mueller",
    buyer_country_code: "CH",
    transaction_amount: 99.0,
    transaction_currency: "CHF",
    payment_status: "paid",
    test_payment: false,
    transaction_processed_at: "2026-03-17T20:40:07+01:00",
  };

  it("verifies the HMAC signature and rejects tampering", () => {
    expect(adapter.verify(ccRequest(sale))).toBe(true);
    const req = ccRequest(sale);
    expect(adapter.verify({ ...req, rawBody: req.rawBody.replace("99", "1") })).toBe(false);
    expect(adapter.verify(ccRequest(sale, "invalid"))).toBe(false);
    expect(adapter.verify({ headers: new Headers(), rawBody: "{}" })).toBe(false);
  });

  it("normalizes a CHF purchase (AK-03)", () => {
    expect(adapter.parse(ccRequest(sale))).toMatchObject({
      type: "purchase",
      transactionId: "53703f91bb7ab490",
      providerOrderId: "7clYUvQI",
      buyerEmail: "max.mueller@example.test",
      buyerCountry: "CH",
      amountMinor: 9900,
      currency: "CHF",
      customerType: "b2c",
      isTest: false,
    });
  });

  it("maps B2B company data (AK-04)", () => {
    const event = adapter.parse(
      ccRequest({
        ...sale,
        buyer_company_name: "Mueller Inc",
        buyer_vat_number: "de 315024481",
        buyer_address: "Teststraße 3",
        buyer_zipcode: "10115",
        buyer_city: "Berlin",
        buyer_country_code: "DE",
      }),
    );
    expect(event).toMatchObject({
      customerType: "b2b",
      billing: {
        companyName: "Mueller Inc",
        vatId: "DE315024481",
        street: "Teststraße 3",
        postalCode: "10115",
        city: "Berlin",
        country: "DE",
      },
    });
  });

  it("maps refunds, chargebacks and unknown events", () => {
    expect(adapter.parse(ccRequest({ ...sale, event_type: "payment.refunded" }))?.type).toBe(
      "refund",
    );
    expect(adapter.parse(ccRequest({ ...sale, event_type: "payment.charged_back" }))?.type).toBe(
      "chargeback",
    );
    expect(adapter.parse(ccRequest({ ...sale, event_type: "payment.pending" }))).toMatchObject({
      type: "unknown",
      providerEventType: "payment.pending",
    });
  });

  it("detects test payments", () => {
    expect(adapter.parse(ccRequest({ ...sale, payment_status: "test_paid" }))?.isTest).toBe(true);
  });

  it("rejects payloads without the required ids", () => {
    expect(() => adapter.parse(ccRequest({ event_type: "payment.made" }))).toThrow();
    expect(() => adapter.parse({ headers: new Headers(), rawBody: "not json" })).toThrow();
  });
});

describe("Digistore24 adapter", () => {
  const adapter = createDigistore24Adapter({ passphrase: "pass" });
  const params = {
    event: "on_payment",
    order_id: "ABC123",
    transaction_id: "999",
    product_id: "12345",
    email: "kundin@example.test",
    address_first_name: "Klara",
    address_country: "DE",
    amount: "49.00",
    currency: "EUR",
  };
  const body = (p: Record<string, string>) =>
    new URLSearchParams({ ...p, sha_sign: digistoreSignature("pass", p) }).toString();

  it("verifies sha_sign", () => {
    expect(adapter.verify({ headers: new Headers(), rawBody: body(params) })).toBe(true);
    expect(
      adapter.verify({ headers: new Headers(), rawBody: body(params).replace("49.00", "1.00") }),
    ).toBe(false);
  });

  it("normalizes a purchase and ignores connection tests", () => {
    expect(adapter.parse({ headers: new Headers(), rawBody: body(params) })).toMatchObject({
      type: "purchase",
      amountMinor: 4900,
      currency: "EUR",
      buyerCountry: "DE",
    });
    expect(
      adapter.parse({ headers: new Headers(), rawBody: body({ event: "connection_test" }) }),
    ).toBeNull();
  });
});

describe("toMinorUnits", () => {
  it("converts decimal strings exactly", () => {
    expect(toMinorUnits("300.25")).toBe(30025);
    expect(toMinorUnits(0.1)).toBe(10);
    expect(toMinorUnits("49,9")).toBe(4990);
    expect(toMinorUnits("-5.5")).toBe(-550);
    expect(toMinorUnits("abc")).toBeUndefined();
  });
});
