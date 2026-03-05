import { handleStripeWebhookRequest } from "@/lib/stripe/webhook-endpoint";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleStripeWebhookRequest(request);
}
