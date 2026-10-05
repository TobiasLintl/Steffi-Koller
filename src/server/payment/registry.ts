import "server-only";

import {
  createCopeCartAdapter,
  createDigistore24Adapter,
  PAYMENT_PROVIDERS,
  type PaymentAdapter,
  type PaymentProviderId,
} from "@/server/adapters/payment";
import { serverEnv } from "@/server/env";

export function isPaymentProvider(value: string): value is PaymentProviderId {
  return (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}

/** Adapter for a provider, or null when its secret is not configured. */
export function paymentAdapter(provider: PaymentProviderId): PaymentAdapter | null {
  const env = serverEnv();
  switch (provider) {
    case "copecart":
      return env.COPECART_WEBHOOK_SECRET
        ? createCopeCartAdapter({ secret: env.COPECART_WEBHOOK_SECRET })
        : null;
    case "digistore24":
      return env.DIGISTORE24_IPN_PASSPHRASE
        ? createDigistore24Adapter({ passphrase: env.DIGISTORE24_IPN_PASSPHRASE })
        : null;
  }
}

export const PROVIDER_LABELS: Record<PaymentProviderId, string> = {
  copecart: "CopeCart",
  digistore24: "Digistore24",
};
