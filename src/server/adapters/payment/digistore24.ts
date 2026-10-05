import type { PaymentAdapter } from "./types";

// Implemented after CopeCart (M3/M16, DECISION D-02).
export function createDigistore24Adapter(): PaymentAdapter {
  return {
    provider: "digistore24",
    async verify() {
      throw new Error("Digistore24 adapter not implemented yet (M16)");
    },
    async parse() {
      throw new Error("Digistore24 adapter not implemented yet (M16)");
    },
  };
}
