import { POST as stripeWebhookPost } from "../stripe/webhook/route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return stripeWebhookPost(request);
}
