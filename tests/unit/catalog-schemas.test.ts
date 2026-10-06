import { describe, expect, it } from "vitest";

import {
  couponInputSchema,
  isCouponActive,
  positionsFor,
  productInputSchema,
} from "@/server/domain/catalog/schemas";

const base = {
  slug: "kleiner-kurs",
  title: "Kleiner Kurs",
  tier: "small",
  kind: "course_access",
  courseId: "8f14e45f-ceea-4ed3-a1d1-1a4b5b8a7c11",
  accessMonths: "6",
  extensionMonths: "",
  priceEur: "49,00",
  priceChf: "52",
  checkoutUrl: "https://www.copecart.com/products/x/checkout",
  isPublished: true,
  sortOrder: "1",
};

describe("product form", () => {
  it("parses prices into minor units and months into numbers", () => {
    expect(productInputSchema.parse(base)).toMatchObject({
      priceEur: 4900,
      priceChf: 5200,
      accessMonths: 6,
      extensionMonths: null,
    });
  });

  it("requires a checkout link for published paid products and https only", () => {
    expect(productInputSchema.safeParse({ ...base, checkoutUrl: "" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, checkoutUrl: "http://x.test" }).success).toBe(
      false,
    );
  });

  it("requires durations matching the product kind", () => {
    expect(productInputSchema.safeParse({ ...base, accessMonths: "" }).success).toBe(false);
    expect(
      productInputSchema.safeParse({ ...base, kind: "extension", extensionMonths: "" }).success,
    ).toBe(false);
    expect(
      productInputSchema.safeParse({ ...base, tier: "free", accessMonths: "", checkoutUrl: "" })
        .success,
    ).toBe(true);
  });

  it("rejects invalid slugs", () => {
    expect(productInputSchema.safeParse({ ...base, slug: "Mit Leerzeichen" }).success).toBe(false);
  });
});

describe("coupons", () => {
  it("stores percent as integer and amounts in minor units", () => {
    expect(
      couponInputSchema.parse({
        code: "sommer10",
        discountType: "percent",
        discountValue: "10",
        currency: "",
        showOnWebsite: false,
        isActive: true,
      }),
    ).toMatchObject({ code: "SOMMER10", discountValue: 10 });
    expect(
      couponInputSchema.parse({
        code: "MINUS5",
        discountType: "amount",
        discountValue: "5,50",
        currency: "EUR",
        showOnWebsite: false,
        isActive: true,
      }).discountValue,
    ).toBe(550);
  });

  it("validates ranges", () => {
    expect(
      couponInputSchema.safeParse({
        code: "X10",
        discountType: "percent",
        discountValue: "120",
        currency: "",
        showOnWebsite: false,
        isActive: true,
      }).success,
    ).toBe(false);
    expect(
      couponInputSchema.safeParse({
        code: "X10",
        discountType: "amount",
        discountValue: "5",
        currency: "",
        showOnWebsite: false,
        isActive: true,
      }).success,
    ).toBe(false);
  });

  it("is active only inside its validity window", () => {
    const c = {
      isActive: true,
      validFrom: new Date("2026-06-01T00:00:00Z"),
      validUntil: new Date("2026-06-30T00:00:00Z"),
    };
    expect(isCouponActive(c, new Date("2026-05-31T00:00:00Z"))).toBe(false);
    expect(isCouponActive(c, new Date("2026-06-15T00:00:00Z"))).toBe(true);
    expect(isCouponActive(c, new Date("2026-06-30T00:00:00Z"))).toBe(false);
    expect(isCouponActive({ ...c, isActive: false }, new Date("2026-06-15T00:00:00Z"))).toBe(false);
  });
});

describe("ordering", () => {
  it("assigns consecutive positions and rejects duplicates", () => {
    expect(positionsFor(["b", "a"])).toEqual([
      { id: "b", position: 0 },
      { id: "a", position: 1 },
    ]);
    expect(() => positionsFor(["a", "a"])).toThrow();
  });
});
