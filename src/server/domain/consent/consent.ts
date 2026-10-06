import { z } from "zod";

/** Bump when categories or the cookie banner text change; old decisions are asked again. */
export const CONSENT_POLICY_VERSION = "2026-10-01";
export const CONSENT_COOKIE = "sz_consent";

export const consentSchema = z.object({
  id: z.uuid(),
  v: z.string(),
  statistics: z.boolean(),
  marketing: z.boolean(),
});

export type ConsentState = z.infer<typeof consentSchema>;

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return JSON.parse(decodeURIComponent(value));
  }
}

/** Accepts the decoded cookie value (as returned by Next's cookies()) or the raw encoded one. */
export function parseConsentCookie(value: string | undefined | null): ConsentState | null {
  if (!value) return null;
  try {
    const parsed = consentSchema.safeParse(parseJson(value));
    if (!parsed.success || parsed.data.v !== CONSENT_POLICY_VERSION) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** Plain JSON – Next's cookie API URL-encodes it exactly once. */
export function serializeConsent(state: ConsentState): string {
  return JSON.stringify(state);
}

/** IPv4: last octet zeroed; IPv6: first 3 groups kept (/48). */
export function truncateIp(ip: string | null | undefined): string | null {
  if (!ip || ip === "unknown") return null;
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0`;
  if (ip.includes(":")) {
    const groups = ip.split(":").filter(Boolean).slice(0, 3);
    return `${groups.join(":")}::`;
  }
  return null;
}
