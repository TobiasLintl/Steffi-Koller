import "server-only";

import type { PaymentProviderId } from "@/server/adapters/payment";
import { db } from "@/server/db";
import { clientIp, createRateLimiter, readBodyLimited } from "@/server/http/rate-limit";
import { receiveWebhook } from "@/server/services/webhooks";
import { runWebhookEffects } from "./effects";
import { paymentAdapter } from "./registry";

const MAX_BODY_BYTES = 64 * 1024;
const limiter = createRateLimiter({ windowMs: 60_000, max: 120 });

function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/** Shared HTTP handling for all reseller webhook endpoints. Logs contain no personal data. */
export async function handlePaymentWebhook(
  request: Request,
  provider: PaymentProviderId,
): Promise<Response> {
  if (!limiter(`${provider}:${clientIp(request.headers)}`)) return text("Too Many Requests", 429);

  const adapter = paymentAdapter(provider);
  if (!adapter) {
    console.error(`[webhook:${provider}] secret not configured`);
    return text("Not configured", 503);
  }

  const rawBody = await readBodyLimited(request, MAX_BODY_BYTES);
  if (rawBody === null) return text("Payload Too Large", 413);

  const outcome = await receiveWebhook(db, adapter, { headers: request.headers, rawBody });
  console.info(
    `[webhook:${provider}] ${outcome.kind}${"eventId" in outcome ? ` ${outcome.eventId}` : ""}`,
  );

  switch (outcome.kind) {
    case "invalid_signature":
      return text("Invalid signature", 401);
    case "bad_payload":
      return text("Bad Request", 400);
    case "failed":
      await runWebhookEffects(outcome.effects);
      // Non-2xx makes the reseller retry (e.g. after a missing product mapping was added).
      return text("Processing failed", 500);
    case "processed":
      await runWebhookEffects(outcome.effects);
      return text(adapter.successResponse, 200);
    default:
      return text(adapter.successResponse, 200);
  }
}
