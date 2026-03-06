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

function metadataTier(metadata: Record<string, string> | null | undefined): "free" | "pro" | "pro_plus" {
  const tier = metadata?.tier ?? metadata?.subscription_tier ?? "pro";
  if (tier === "pro_plus" || tier === "pro+") return "pro_plus";
  if (tier === "pro") return "pro";
  return "free";
}

function calculateTrialEnd(trialDays: number = 7): string {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);
  return trialEnd.toISOString();
}

async function upsertUserById(input: {
  userId: string;
  status: "active" | "inactive";
  tier?: "free" | "pro" | "pro_plus";
  trialEnd?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
}) {
  console.log("[WEBHOOK] upsertUserById called:", JSON.stringify(input));
  
  const { data, error } = await supabaseAdmin.from("users").upsert(
    {
      id: input.userId,
      subscription_status: input.status,
      subscription_tier: input.tier ?? (input.status === "active" ? "pro" : "free"),
      trial_end: input.trialEnd ?? null,
      stripe_customer_id: input.customerId ?? null,
      stripe_subscription_id: input.subscriptionId ?? null
    },
    { onConflict: "id" }
  ).select();

  if (error) {
    console.error("[WEBHOOK] upsertUserById ERROR:", error.message);
    throw new Error(`Failed to upsert user ${input.userId}: ${error.message}`);
  }
  
  console.log("[WEBHOOK] upsertUserById SUCCESS:", JSON.stringify(data));
}


async function updateUserByCustomerId(input: {
  customerId: string;
  status: "active" | "inactive";
  tier?: "free" | "pro" | "pro_plus";
  subscriptionId?: string | null;
}) {
  console.log("[WEBHOOK] updateUserByCustomerId called:", JSON.stringify(input));
  
  const updatePayload: Record<string, unknown> = {
    subscription_status: input.status,
    stripe_subscription_id: input.subscriptionId ?? null
  };
  
  // Only update tier if provided
  if (input.tier) {
    updatePayload.subscription_tier = input.tier;
  }
  
  const { data, error } = await supabaseAdmin
    .from("users")
    .update(updatePayload)
    .eq("stripe_customer_id", input.customerId)
    .select("id")
    .limit(1);

  if (error) {
    console.error("[WEBHOOK] updateUserByCustomerId ERROR:", error.message);
    throw new Error(`Failed update by customer ${input.customerId}: ${error.message}`);
  }

  console.log("[WEBHOOK] updateUserByCustomerId result:", JSON.stringify(data));
  return (data?.length ?? 0) > 0;
}

export async function POST(req: Request) {
  console.log("[WEBHOOK] POST handler called");
  console.log("[WEBHOOK] ENV CHECK - SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING");
  console.log("[WEBHOOK] ENV CHECK - SERVICE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + "..." : "MISSING");
  
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

  console.log("[WEBHOOK] Stripe event:", event.type, event.id);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.client_reference_id ?? metadataUserId(session.metadata) ?? null;
        const tier = metadataTier(session.metadata);
        const isTrialCheckout = session.metadata?.trial === "true";

        const stripeCustomerId = customerIdOf(session.customer);
        const stripeSubscriptionId = subscriptionIdOf(session.subscription as string | Stripe.Subscription | null);

        console.log("[WEBHOOK] checkout.session.completed:", {
          sessionId: session.id,
          userId,
          tier,
          isTrialCheckout,
          customerId: stripeCustomerId,
          subscriptionId: stripeSubscriptionId
        });

        if (userId) {
          console.log("[WEBHOOK] Activating by userId:", userId);
          await upsertUserById({
            userId,
            status: "active",
            tier: tier,
            trialEnd: isTrialCheckout ? calculateTrialEnd(7) : null,
            customerId: stripeCustomerId,
            subscriptionId: stripeSubscriptionId
          });
          console.log("[WEBHOOK] User activated successfully");
          break;
        }

        if (stripeCustomerId) {
          console.log("[WEBHOOK] Activating by customerId:", stripeCustomerId);
          const updated = await updateUserByCustomerId({
            customerId: stripeCustomerId,
            status: "active",
            tier: tier,
            subscriptionId: stripeSubscriptionId
          });

          if (updated) {
            console.log("[WEBHOOK] User activated by customer ID");
            break;
          }
        }

        console.error("[WEBHOOK] checkout.session.completed could not map to user", {
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

        // get user id from metadata
        const userId = subscription.metadata?.user_id;

        if (!userId) {
          console.error("Missing user_id in subscription metadata");
          return NextResponse.json({ error: "Missing user id" }, { status: 400 });
        }

        const { error } = await supabaseAdmin
          .from("users")
          .update({
            subscription_status: status,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: stripeCustomerId
          })
          .eq("id", userId);

        if (error) {
          console.error("Failed to update subscription:", error);
          return NextResponse.json({ error: "Database update failed" }, { status: 500 });
        }

        console.log("[WEBHOOK] subscription.updated success for user:", userId);
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

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = customerIdOf(invoice.customer);
        const stripeSubscriptionId = subscriptionIdOf(invoice.subscription as string | Stripe.Subscription | null);

        console.log("[WEBHOOK] invoice.payment_succeeded:", {
          invoiceId: invoice.id,
          customerId: stripeCustomerId,
          subscriptionId: stripeSubscriptionId,
          billingReason: invoice.billing_reason
        });

        // Only update for subscription-related invoices
        if (stripeCustomerId && stripeSubscriptionId) {
          const updated = await updateUserByCustomerId({
            customerId: stripeCustomerId,
            status: "active",
            subscriptionId: stripeSubscriptionId
          });

          if (updated) {
            console.log("[WEBHOOK] User activated via invoice.payment_succeeded");
          }
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = customerIdOf(invoice.customer);

        console.log("[WEBHOOK] invoice.payment_failed:", {
          invoiceId: invoice.id,
          customerId: stripeCustomerId
        });

        // Mark as inactive when payment fails
        if (stripeCustomerId) {
          await updateUserByCustomerId({
            customerId: stripeCustomerId,
            status: "inactive"
          });
        }

        break;
      }

      default:
        console.log("[WEBHOOK] Unhandled event type:", event.type);
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Unhandled webhook error:", err);
    return NextResponse.json({ error: "Webhook handler failure" }, { status: 500 });
  }
}