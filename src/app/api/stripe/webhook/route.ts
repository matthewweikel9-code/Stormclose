import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const REQUIRED_ENV_VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL"
] as const;

for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]?.trim()) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}

function getSubscriptionId(subscription: string | Stripe.Subscription | null) {
  if (!subscription) {
    return null;
  }

  return typeof subscription === "string" ? subscription : subscription.id;
}

function isActiveStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

async function upsertUserSubscriptionByUserId(input: {
  userId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  active: boolean;
}) {
  const admin = createAdminClient();

  const fullPayload = {
    id: input.userId,
    stripe_customer_id: input.customerId ?? null,
    stripe_subscription_id: input.subscriptionId ?? null,
    subscription_status: input.active ? "active" : "inactive",
    plan_active: input.active
  };

  const fullResult = await (admin.from("users") as any).upsert(fullPayload, { onConflict: "id" });

  if (!fullResult.error) {
    return;
  }

  const fallbackResult = await (admin.from("users") as any).upsert(
    {
      id: input.userId,
      stripe_customer_id: input.customerId ?? null,
      subscription_status: input.active ? "active" : "inactive"
    },
    { onConflict: "id" }
  );

  if (fallbackResult.error) {
    throw new Error(`Failed to upsert user subscription: ${fallbackResult.error.message}`);
  }
}

async function updateUserSubscriptionByCustomerId(input: {
  customerId: string;
  subscriptionId?: string | null;
  active: boolean;
}) {
  const admin = createAdminClient();

  const fullResult = await (admin.from("users") as any)
    .update({
      stripe_subscription_id: input.subscriptionId ?? null,
      subscription_status: input.active ? "active" : "inactive",
      plan_active: input.active
    })
    .eq("stripe_customer_id", input.customerId);

  if (!fullResult.error) {
    return;
  }

  const fallbackResult = await (admin.from("users") as any)
    .update({
      subscription_status: input.active ? "active" : "inactive"
    })
    .eq("stripe_customer_id", input.customerId);

  if (fallbackResult.error) {
    throw new Error(`Failed to update user by customer ID: ${fallbackResult.error.message}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = getCustomerId(session.customer);
  const subscriptionId = getSubscriptionId(session.subscription as string | Stripe.Subscription | null);
  const userId = session.client_reference_id ?? session.metadata?.user_id ?? session.metadata?.userId ?? null;

  if (!userId) {
    if (customerId) {
      await updateUserSubscriptionByCustomerId({
        customerId,
        subscriptionId,
        active: true
      });
      return;
    }

    console.warn("Stripe webhook checkout.session.completed missing user ID and customer ID");
    return;
  }

  await upsertUserSubscriptionByUserId({
    userId,
    customerId,
    subscriptionId,
    active: true
  });
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const customerId = getCustomerId(subscription.customer);
  const active = isActiveStatus(subscription.status);

  if (customerId) {
    await updateUserSubscriptionByCustomerId({
      customerId,
      subscriptionId: subscription.id,
      active
    });
    return;
  }

  const userId = subscription.metadata?.user_id ?? subscription.metadata?.userId ?? null;

  if (!userId) {
    console.warn("Stripe webhook subscription event missing customer and user ID");
    return;
  }

  await upsertUserSubscriptionByUserId({
    userId,
    subscriptionId: subscription.id,
    active
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.log("Stripe event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
