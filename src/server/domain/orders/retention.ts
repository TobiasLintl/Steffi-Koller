import { addMonths } from "@/server/domain/access/dates";

/** Purchase records are kept for the statutory retention period (10 years, §147 AO/§257 HGB). */
export const ORDER_RETENTION_YEARS = 10;

export function orderRetentionUntil(purchasedAt: Date): Date {
  return addMonths(purchasedAt, ORDER_RETENTION_YEARS * 12);
}
