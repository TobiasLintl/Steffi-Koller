import { describe, expect, it } from "vitest";

import { customerProfileSchema, normalizeProfile } from "@/server/domain/customers/profile";

describe("customer profile validation (AK-04)", () => {
  it("accepts a B2B profile with company, billing address and VAT id", () => {
    const result = customerProfileSchema.safeParse({
      customerType: "b2b",
      companyName: "Beispiel GmbH",
      vatId: "de 123456789",
      street: "Musterweg 1",
      postalCode: "10115",
      city: "Berlin",
      country: "DE",
    });
    expect(result.success).toBe(true);
    expect(result.data?.vatId).toBe("DE123456789");
  });

  it("accepts a Swiss UID as VAT id", () => {
    const result = customerProfileSchema.safeParse({
      customerType: "b2b",
      companyName: "Muster AG",
      vatId: "CHE-123.456.789 MWST",
      street: "Bahnhofstrasse 1",
      postalCode: "8001",
      city: "Zürich",
      country: "CH",
    });
    expect(result.success).toBe(true);
  });

  it("requires company name and billing address for B2B", () => {
    const result = customerProfileSchema.safeParse({ customerType: "b2b" });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(
      expect.arrayContaining(["companyName", "street", "postalCode", "city", "country"]),
    );
  });

  it("drops company data for private customers", () => {
    const parsed = customerProfileSchema.parse({
      customerType: "b2c",
      companyName: "Alt GmbH",
      vatId: "DE123456789",
    });
    expect(normalizeProfile(parsed)).toMatchObject({ companyName: null, vatId: null });
  });
});
