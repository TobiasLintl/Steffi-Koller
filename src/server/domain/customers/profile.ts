import { z } from "zod";

import { COUNTRY_CODES } from "@/lib/countries";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/** Loose EU/CH VAT id shape check; authoritative validation is done by the reseller. */
export const VAT_ID_PATTERN =
  /^(?:[A-Z]{2}[A-Z0-9+*]{2,13}|CHE-?\d{3}\.?\d{3}\.?\d{3}(?: ?(?:MWST|TVA|IVA))?)$/;

export const customerProfileSchema = z
  .object({
    customerType: z.enum(["b2c", "b2b"]),
    firstName: optionalText(100),
    lastName: optionalText(100),
    country: z.enum(COUNTRY_CODES).nullable().optional(),
    companyName: optionalText(200),
    vatId: optionalText(30).transform((v) => (v ? v.toUpperCase().replace(/\s+/g, "") : v)),
    street: optionalText(200),
    postalCode: optionalText(20),
    city: optionalText(100),
  })
  .superRefine((value, ctx) => {
    if (value.customerType !== "b2b") return;
    if (!value.companyName) {
      ctx.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Bitte gib den Firmennamen an.",
      });
    }
    for (const field of ["street", "postalCode", "city", "country"] as const) {
      if (!value[field]) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Für Firmen brauchen wir die Rechnungsanschrift.",
        });
      }
    }
    if (value.vatId && !VAT_ID_PATTERN.test(value.vatId)) {
      ctx.addIssue({
        code: "custom",
        path: ["vatId"],
        message: "Die USt-IdNr. sieht nicht gültig aus.",
      });
    }
  });

export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;

/** B2B-only fields are cleared for private customers so stale company data is not kept. */
export function normalizeProfile(input: CustomerProfileInput): CustomerProfileInput {
  if (input.customerType === "b2b") return input;
  return { ...input, companyName: null, vatId: null };
}
