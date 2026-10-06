import { consentRecords } from "@/server/db/schema";
import type { DbExecutor } from "@/server/db/types";
import {
  CONSENT_POLICY_VERSION,
  truncateIp,
  type ConsentState,
} from "@/server/domain/consent/consent";

/** Stores proof of a cookie consent decision (TDDDG §25). */
export async function recordConsent(
  db: DbExecutor,
  state: ConsentState,
  meta: { ip?: string | null; userAgent?: string | null },
) {
  await db.insert(consentRecords).values({
    consentId: state.id,
    statistics: state.statistics,
    marketing: state.marketing,
    policyVersion: CONSENT_POLICY_VERSION,
    ipTruncated: truncateIp(meta.ip),
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  });
}
