import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { z } from "zod";

import { db } from "@/server/db";
import {
  CONSENT_COOKIE,
  CONSENT_POLICY_VERSION,
  parseConsentCookie,
  serializeConsent,
} from "@/server/domain/consent/consent";
import { clientIp, createRateLimiter } from "@/server/http/rate-limit";
import { recordConsent } from "@/server/services/consent";

const bodySchema = z.object({ statistics: z.boolean(), marketing: z.boolean() });
const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });

/** Saves a cookie consent decision: cookie for the browser, record as proof (TDDDG §25). */
export async function POST(request: Request) {
  if (!limiter(clientIp(request.headers)))
    return new Response("Too Many Requests", { status: 429 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Bad Request", { status: 400 });

  const jar = await cookies();
  const previous = parseConsentCookie(jar.get(CONSENT_COOKIE)?.value);
  const state = { id: previous?.id ?? randomUUID(), v: CONSENT_POLICY_VERSION, ...parsed.data };
  await recordConsent(db, state, {
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  jar.set(CONSENT_COOKIE, serializeConsent(state), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false, // read by the banner and the script loader
  });
  return Response.json(state);
}
