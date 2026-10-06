import { z } from "zod";

import { PRODUCT_TIERS } from "@/server/domain/access/product-defaults";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche.");
const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(min).max(max).nullable(),
  );
const money = z.preprocess(
  (v) =>
    v === "" || v === null || v === undefined
      ? null
      : Math.round(Number(String(v).replace(",", ".")) * 100),
  z.number().int().min(0).max(10_000_000).nullable(),
);
const httpsUrl = z.preprocess(
  (v) => (v === "" ? null : v),
  z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), "Link muss mit https:// beginnen.")
    .nullable(),
);

/** Product form. Prices are entered in EUR/CHF and stored in minor units. */
export const productInputSchema = z
  .object({
    slug,
    title: z.string().trim().min(2).max(150),
    subtitle: z.string().trim().max(300).default(""),
    description: z.string().trim().max(20_000).default(""),
    tier: z.enum(PRODUCT_TIERS),
    kind: z.enum(["course_access", "extension", "coaching"]),
    courseId: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()),
    accessMonths: optionalInt(1, 120),
    extensionMonths: optionalInt(1, 60),
    priceEur: money,
    priceChf: money,
    checkoutUrl: httpsUrl,
    isPublished: z.boolean(),
    sortOrder: z.preprocess(
      (v) => (v === "" || v === undefined ? 0 : Number(v)),
      z.number().int().min(0).max(10_000),
    ),
  })
  .superRefine((p, ctx) => {
    if (p.kind !== "coaching" && !p.courseId)
      ctx.addIssue({ code: "custom", path: ["courseId"], message: "Bitte einen Kurs wählen." });
    if (p.kind === "extension" && !p.extensionMonths)
      ctx.addIssue({
        code: "custom",
        path: ["extensionMonths"],
        message: "Verlängerungsdauer fehlt.",
      });
    if (p.kind === "course_access" && p.tier !== "free" && !p.accessMonths) {
      ctx.addIssue({
        code: "custom",
        path: ["accessMonths"],
        message: "Bezahlte Kurse brauchen eine Zugangsdauer.",
      });
    }
    if (p.isPublished && p.tier !== "free" && !p.checkoutUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["checkoutUrl"],
        message: "Veröffentlichte Produkte brauchen einen Kauf-Link.",
      });
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;

export const courseInputSchema = z.object({
  slug,
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(5000).default(""),
  isPublished: z.boolean(),
});

export const moduleInputSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).default(""),
  unlockAfterDays: z.preprocess(
    (v) => (v === "" ? 0 : Number(v)),
    z.number().int().min(0).max(3650),
  ),
});

export const lessonInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(50_000).default(""),
  transcript: z.string().max(200_000).default(""),
  durationMinutes: optionalInt(1, 600),
});

/** Coupons / promotions. */
export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/, "3–40 Zeichen: Buchstaben, Ziffern, - oder _."),
    description: z.string().trim().max(500).default(""),
    discountType: z.enum(["percent", "amount"]),
    discountValue: z.preprocess((v) => Number(String(v).replace(",", ".")), z.number().positive()),
    currency: z.preprocess((v) => (v === "" ? null : v), z.enum(["EUR", "CHF"]).nullable()),
    validFrom: z.preprocess((v) => (v ? new Date(String(v)) : null), z.date().nullable()),
    validUntil: z.preprocess((v) => (v ? new Date(String(v)) : null), z.date().nullable()),
    productIds: z.array(z.uuid()).default([]),
    providerReference: z.string().trim().max(200).default(""),
    showOnWebsite: z.boolean(),
    websiteNotice: z.string().trim().max(300).default(""),
    isActive: z.boolean(),
  })
  .superRefine((c, ctx) => {
    if (c.discountType === "percent" && c.discountValue > 100)
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Höchstens 100 %." });
    if (c.discountType === "amount" && !c.currency)
      ctx.addIssue({ code: "custom", path: ["currency"], message: "Bitte Währung wählen." });
    if (c.validFrom && c.validUntil && c.validUntil <= c.validFrom)
      ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Ende liegt vor dem Beginn." });
  })
  .transform((c) => ({
    ...c,
    discountValue:
      c.discountType === "percent"
        ? Math.round(c.discountValue)
        : Math.round(c.discountValue * 100),
  }));

export function isCouponActive(
  c: { isActive: boolean; validFrom: Date | null; validUntil: Date | null },
  now: Date,
): boolean {
  if (!c.isActive) return false;
  if (c.validFrom && c.validFrom.getTime() > now.getTime()) return false;
  if (c.validUntil && c.validUntil.getTime() <= now.getTime()) return false;
  return true;
}

/** Reorders ids: returns the new position for each id (0..n-1) – used by drag & drop. */
export function positionsFor(ids: string[]): { id: string; position: number }[] {
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate ids in ordering");
  return ids.map((id, position) => ({ id, position }));
}
