import type { PaymentAdapter } from "./types";

// Implemented in M3 (DECISION D-02: CopeCart first).
export function createCopeCartAdapter(): PaymentAdapter {
  return {
    provider: "copecart",
    async verify() {
      throw new Error("CopeCart adapter not implemented yet (M3)");
    },
    async parse() {
      throw new Error("CopeCart adapter not implemented yet (M3)");
    },
  };
}
