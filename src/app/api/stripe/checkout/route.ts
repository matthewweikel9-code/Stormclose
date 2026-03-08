import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSubscriptionCheckoutSession } from "@/lib/stripe/checkout";
import { stripeConfig, getPriceIdForTier, type SubscriptionPriceTier } from "@/lib/stripe/config";

export const runtime = "nodejs";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function getRequestOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (forwardedProto && forwardedHost) {
    return normalizeBaseUrl(`${forwardedProto}://${forwardedHost}`);
  }

  return normalizeBaseUrl(new URL(request.url).origin);
}

export async function POST(request: Request) {
  // Parse request body for tier
  let tier: SubscriptionPriceTier = "pro";
  try {
    const body = await request.json();
    if (body.tier === "pro" || body.tier === "pro_plus" || body.tier === "enterprise") {
      tier = body.tier;
    }
  } catch {
    // Default to pro if no body or invalid JSON
  }

  const priceId = getPriceIdForTier(tier);
  if (!stripeConfig.secretKey || !priceId) {
    return NextResponse.json(
      { error: `Stripe is not configured. Missing STRIPE_SECRET_KEY or price ID for ${tier} tier.` },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userRecord } = await (supabase
    .from("users") as any)
    .select("id,email,stripe_customer_id,subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  const session = await createSubscriptionCheckoutSession({
    userId: user.id,
    email: user.email,
    userRecord,
    tier,
    appUrl: getRequestOrigin(request),
    upsertUser: async (payload) => {
      await (supabase.from("users") as any).upsert(payload, { onConflict: "id" });
    }
  });

  if (!session.url) {
    return NextResponse.json({ error: "Failed to create checkout session URL" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
