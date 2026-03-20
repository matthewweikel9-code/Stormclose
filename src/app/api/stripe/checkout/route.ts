import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserSubscription } from "@/lib/subscriptions/access";
import { getUserRoleForTeam, hasMinimumRole } from "@/lib/server/tenant";
import { createSubscriptionCheckoutSession } from "@/lib/stripe/checkout";
import {
	stripeConfig,
	getPriceIdForTier,
	getMissingStripePriceEnvVars,
	type SubscriptionPriceTier
} from "@/lib/stripe/config";

export const runtime = "nodejs";

const TIER_PRIORITY: Record<string, number> = {
	free: 0,
	trial: 1,
	pro: 2,
	enterprise: 4,
};

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
  let teamId: string | null = null;
  try {
    const body = await request.json();
    if (body.tier === "pro" || body.tier === "enterprise") {
      tier = body.tier;
    }
    if (typeof body.teamId === "string" && body.teamId.trim().length > 0) {
      teamId = body.teamId.trim();
    }
  } catch {
    // Default to pro if no body or invalid JSON
  }

  const priceId = getPriceIdForTier(tier);
  if (!stripeConfig.secretKey || !priceId) {
    const missingPriceVars = getMissingStripePriceEnvVars();
    return NextResponse.json(
      {
        error: `Stripe is not configured. Missing STRIPE_SECRET_KEY or price ID for ${tier} tier.`,
        missingPriceVars: missingPriceVars.length > 0 ? missingPriceVars : undefined
      },
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

  if (teamId) {
    const role = await getUserRoleForTeam(supabase, user.id, teamId);
    if (!hasMinimumRole(role, "admin")) {
      return NextResponse.json(
        {
          error: "Only team admins can start checkout for this team.",
          code: "UPGRADE_REQUIRED",
          upgradeUrl: "/settings/billing",
        },
        { status: 403 }
      );
    }
  }

  let currentTier = "free";
  if (teamId) {
    const { data: team } = await (supabase.from("teams") as any)
      .select("subscription_tier, subscription_status")
      .eq("id", teamId)
      .maybeSingle();

    const status = typeof team?.subscription_status === "string" ? team.subscription_status : "inactive";
    const teamTier = typeof team?.subscription_tier === "string" ? team.subscription_tier : "free";
    currentTier = status === "active" || status === "trialing" ? teamTier : "free";
  } else {
    const subscription = await getUserSubscription(user.id);
    currentTier = subscription?.effectiveTier ?? "free";
  }

  if ((TIER_PRIORITY[currentTier] ?? 0) >= (TIER_PRIORITY[tier] ?? 0)) {
    return NextResponse.json(
      {
        error: `Your account already has ${currentTier.replace("_", "+")} access. Choose a higher tier to upgrade.`,
        code: "ALREADY_ENTITLED",
        currentTier,
      },
      { status: 409 }
    );
  }

  const { data: userRecord } = await (supabase
    .from("users") as any)
    .select("id,email,stripe_customer_id,subscription_status,subscription_tier")
    .eq("id", user.id)
    .maybeSingle();

  const session = await createSubscriptionCheckoutSession({
    userId: user.id,
    email: user.email,
    userRecord,
    tier,
    teamId,
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
