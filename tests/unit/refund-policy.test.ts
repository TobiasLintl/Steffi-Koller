import { describe, expect, it } from "vitest";

import { DEFAULT_REFUND_POLICY, refundAction } from "@/server/domain/orders/refund-policy";
import { orderRetentionUntil } from "@/server/domain/orders/retention";

describe("refund policy (D-01)", () => {
  it("defaults to revoking access and notifying the admin", () => {
    expect(DEFAULT_REFUND_POLICY).toEqual({ action: "revoke", notifyAdmin: true });
    expect(refundAction(DEFAULT_REFUND_POLICY, "course_access")).toBe("revoke_entitlement");
    expect(refundAction(DEFAULT_REFUND_POLICY, "extension")).toBe("rollback_extension");
  });

  it("can be configured to keep access", () => {
    expect(refundAction({ action: "keep", notifyAdmin: true }, "course_access")).toBe("none");
  });
});

describe("order retention", () => {
  it("keeps purchase records for 10 years", () => {
    expect(orderRetentionUntil(new Date("2026-03-01T00:00:00Z"))).toEqual(
      new Date("2036-03-01T00:00:00Z"),
    );
  });
});
