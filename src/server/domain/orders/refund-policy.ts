import { z } from "zod";

/**
 * DECISION D-01 (open): what happens to access on refund, cancellation or chargeback.
 * Configurable in the admin; default until decided: block access immediately and notify.
 */
export const refundPolicySchema = z.object({
  action: z.enum(["revoke", "keep"]),
  notifyAdmin: z.boolean(),
});

export type RefundPolicy = z.infer<typeof refundPolicySchema>;

export const DEFAULT_REFUND_POLICY: RefundPolicy = { action: "revoke", notifyAdmin: true };

export type RefundAction = "revoke_entitlement" | "rollback_extension" | "none";

export function refundAction(
  policy: RefundPolicy,
  productKind: "course_access" | "extension" | "coaching",
): RefundAction {
  if (policy.action === "keep") return "none";
  if (productKind === "course_access") return "revoke_entitlement";
  if (productKind === "extension") return "rollback_extension";
  return "none";
}
