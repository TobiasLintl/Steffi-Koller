/**
 * Default access rules per product tier (CLAUDE.md §5.1). These are only defaults for new
 * products in the admin – the stored per-product values are authoritative. Do not hard-code.
 */
export const PRODUCT_TIERS = ["free", "small", "medium", "large", "coaching"] as const;
export type ProductTier = (typeof PRODUCT_TIERS)[number];

export interface TierDefaults {
  /** null = unlimited access. */
  accessMonths: number | null;
  extensionMonths: number | null;
}

export const TIER_DEFAULTS: Record<ProductTier, TierDefaults> = {
  free: { accessMonths: null, extensionMonths: null },
  small: { accessMonths: 6, extensionMonths: 3 },
  medium: { accessMonths: 6, extensionMonths: 3 },
  large: { accessMonths: 24, extensionMonths: 6 },
  coaching: { accessMonths: null, extensionMonths: null },
};

export const TIER_LABELS: Record<ProductTier, string> = {
  free: "Kostenlos",
  small: "Klein",
  medium: "Mittel",
  large: "Groß",
  coaching: "Coaching",
};
