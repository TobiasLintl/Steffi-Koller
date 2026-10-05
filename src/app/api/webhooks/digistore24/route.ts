import { handlePaymentWebhook } from "@/server/payment/handle-webhook";

export async function POST(request: Request) {
  return handlePaymentWebhook(request, "digistore24");
}
