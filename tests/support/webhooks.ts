import { readFileSync } from "node:fs";

import { copecartSignature, digistoreSignature } from "@/server/adapters/payment";

export function copecartFixture(
  name: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const data = JSON.parse(readFileSync(`tests/fixtures/copecart/${name}.json`, "utf8")) as Record<
    string,
    unknown
  >;
  return { ...data, ...overrides };
}

export function copecartRequest(
  payload: Record<string, unknown>,
  secret = process.env.COPECART_WEBHOOK_SECRET ?? "",
): Request {
  const body = JSON.stringify(payload);
  return new Request("http://localhost/api/webhooks/copecart", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-copecart-signature": copecartSignature(secret, body),
      "user-agent": "Copecart",
    },
    body,
  });
}

export function digistoreRequest(
  name: string,
  passphrase = process.env.DIGISTORE24_IPN_PASSPHRASE ?? "",
): Request {
  const params = Object.fromEntries(
    new URLSearchParams(readFileSync(`tests/fixtures/digistore24/${name}.txt`, "utf8").trim()),
  );
  const body = new URLSearchParams({
    ...params,
    sha_sign: digistoreSignature(passphrase, params),
  }).toString();
  return new Request("http://localhost/api/webhooks/digistore24", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}
