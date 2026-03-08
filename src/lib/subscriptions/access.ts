import { createClient } from "@/lib/supabase/server";
import type { SubscriptionTier, FeatureKey } from "./tiers";
import { hasFeature, getEffectiveTier, getDaysRemaining } from "./tiers";

export interface UserSubscription {
	tier: SubscriptionTier;
	effectiveTier: SubscriptionTier;
	trialEnd: string | null;
	trialDaysRemaining: number;
	reportsThisMonth: number;
	reportsResetAt: string;
	stripeCustomerId: string | null;
	stripeSubscriptionId: string | null;
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
	const supabase = await createClient();

	const { data, error } = await (supabase
		.from("users") as any)
		.select(
			"subscription_tier, trial_end, reports_this_month, reports_reset_at, stripe_customer_id, stripe_subscription_id"
		)
		.eq("id", userId)
		.maybeSingle();

	if (error) {
		console.error("[getUserSubscription] Error fetching user:", error.message);
		return null;
	}

	// If user doesn't exist in users table, create them with free tier
	if (!data) {
		console.log("[getUserSubscription] User not found, creating with free tier:", userId);
		const { error: insertError } = await (supabase
			.from("users") as any)
			.upsert({
				id: userId,
				subscription_tier: "free",
				subscription_status: "inactive",
				reports_this_month: 0,
				reports_reset_at: new Date().toISOString()
			}, { onConflict: "id" });

		if (insertError) {
			console.error("[getUserSubscription] Error creating user:", insertError.message);
			return null;
		}

		return {
			tier: "free",
			effectiveTier: "free",
			trialEnd: null,
			trialDaysRemaining: 0,
			reportsThisMonth: 0,
			reportsResetAt: new Date().toISOString(),
			stripeCustomerId: null,
			stripeSubscriptionId: null
		};
	}

	const tier = (data.subscription_tier as SubscriptionTier) || "free";
	const trialEnd = data.trial_end || null;

	return {
		tier,
		effectiveTier: getEffectiveTier(tier, trialEnd),
		trialEnd,
		trialDaysRemaining: getDaysRemaining(trialEnd),
		reportsThisMonth: data.reports_this_month || 0,
		reportsResetAt: data.reports_reset_at || new Date().toISOString(),
		stripeCustomerId: data.stripe_customer_id,
		stripeSubscriptionId: data.stripe_subscription_id
	};
}

export async function checkFeatureAccess(
	userId: string,
	feature: FeatureKey
): Promise<{ allowed: boolean; reason?: string; tier?: SubscriptionTier }> {
	const subscription = await getUserSubscription(userId);

	if (!subscription) {
		return { allowed: false, reason: "User not found", tier: "free" };
	}

	const { effectiveTier } = subscription;

	if (!hasFeature(effectiveTier, feature)) {
		const featureNames: Record<FeatureKey, string> = {
			objection_handler: "Objection Handler",
			supplement_generator: "Supplement Generator",
			negotiation_coach: "Negotiation Coach",
			carrier_intelligence: "Carrier Intelligence",
			storm_command: "Storm Command Center",
			roof_measurement: "Roof Measurement AI"
		};

		return {
			allowed: false,
			reason: `${featureNames[feature]} requires a higher subscription tier.`,
			tier: effectiveTier
		};
	}

	return { allowed: true, tier: effectiveTier };
}
