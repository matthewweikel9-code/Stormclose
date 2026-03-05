import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const requiredEnv = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY"
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]?.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20"
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

function normalizeSubscriptionStatus(status: string | null | undefined) {
  if (!status) return "inactive";
  return status === "active" || status === "trialing" ? "active" : "inactive";
}

function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function subscriptionIdOf(
  subscription: string | Stripe.Subscription | null
): string | null {
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

function metadataUserId(metadata: Record<string, string> | null | undefined) {
  return metadata?.user_id ?? metadata?.userId ?? null;
}

async function upsertUserById(input: {
  userId: string;
  status: "active" | "inactive";
  customerId?: string | null;
  subscriptionId?: string | null;
}) {
  const { error } = await supabaseAdmin.from("users").upsert(
    {
      id: input.userId,
      subscription_status: input.status,
      stripe_customer_id: input.customerId ?? null,
      stripe_subscription_id: input.subscriptionId ?? null
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`Failed to upsert user ${input.userId}: ${error.message}`);
  }
}

async function updateUserByCustomerId(input: {
  customerId: string;
  status: "active" | "inactive";
  subscriptionId?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({
      subscription_status: input.status,
      stripe_subscription_id: input.subscriptionId ?? null
    })
    .eq("stripe_customer_id", input.customerId)
    .select("id")
    .limit(1);

  if (error) {
    throw new Error(`Failed update by customer ${input.customerId}: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  console.log("Stripe event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.client_reference_id ?? metadataUserId(session.metadata) ?? null;

        const stripeCustomerId = customerIdOf(session.customer);
        const stripeSubscriptionId = subscriptionIdOf(session.subscription as string | Stripe.Subscription | null);

        if (userId) {
          await upsertUserById({
            userId,
            status: "active",
            customerId: stripeCustomerId,
            subscriptionId: stripeSubscriptionId
          });
          break;
        }

        if (stripeCustomerId) {
          const updated = await updateUserByCustomerId({
            customerId: stripeCustomerId,
            status: "active",
            subscriptionId: stripeSubscriptionId
          });

          if (updated) {
            break;
          }
        }

        console.error("checkout.session.completed could not map to user", {
          sessionId: session.id,
          customerId: stripeCustomerId,
          subscriptionId: stripeSubscriptionId
        });

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = customerIdOf(subscription.customer);
        const status = normalizeSubscriptionStatus(subscription.status);
        const userId = metadataUserId(subscription.metadata);

        if (stripeCustomerId) {
          const updated = await updateUserByCustomerId({
            customerId: stripeCustomerId,
            status,
            subscriptionId: subscription.id
          });

          if (updated) {
            break;
          }
        }

        if (userId) {
          await upsertUserById({
            userId,
            status,
            customerId: stripeCustomerId,
            subscriptionId: subscription.id
          });
          break;
        }

        console.error("subscription.updated could not map to user", {
          subscriptionId: subscription.id,
          customerId: stripeCustomerId
        });

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = customerIdOf(subscription.customer);
        const userId = metadataUserId(subscription.metadata);

        if (stripeCustomerId) {
          const updated = await updateUserByCustomerId({
            customerId: stripeCustomerId,
            status: "inactive",
            subscriptionId: subscription.id
          });

          if (updated) {
            break;
          }
        }

        if (userId) {
          await upsertUserById({
            userId,
            status: "inactive",
            customerId: stripeCustomerId,
            subscriptionId: subscription.id
          });
          break;
        }

        console.error("subscription.deleted could not map to user", {
          subscriptionId: subscription.id,
          customerId: stripeCustomerId
        });

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Unhandled webhook error:", err);
    return NextResponse.json({ error: "Webhook handler failure" }, { status: 500 });
  }
}