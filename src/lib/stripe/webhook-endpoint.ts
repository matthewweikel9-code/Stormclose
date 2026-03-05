import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { stripeConfig } from "@/lib/stripe/config";
import { handleStripeEvent } from "@/lib/stripe/webhook-handlers";

export async function handleStripeWebhookRequest(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature || !stripeConfig.webhookSecret) {
    return NextResponse.json(
      { error: "Missing stripe signature or webhook secret" },
      { status: 400 }
    );
  }

  const payload = await request.text();

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, stripeConfig.webhookSecret);
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
