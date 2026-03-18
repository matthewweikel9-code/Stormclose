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

const TIER_PRIORITY: Record<SubscriptionTier, number> = {
	free: 0,
	trial: 1,
	pro: 2,
	pro_plus: 3,
	enterprise: 4,
};

function maxTier(a: SubscriptionTier, b: SubscriptionTier): SubscriptionTier {
	return TIER_PRIORITY[a] >= TIER_PRIORITY[b] ? a : b;
}

async function getHighestTeamTier(supabase: any, userId: string): Promise<SubscriptionTier | null> {
	try {
		const { data, error } = await (supabase.from("team_members") as any)
			.select("team:teams(id, subscription_tier, subscription_status, owner_id)")
			.eq("user_id", userId);

		if (error || !Array.isArray(data)) {
			return null;
		}

		let highestTier: SubscriptionTier | null = null;
		for (const membership of data as Array<{ team?: { id?: string; subscription_tier?: unknown; subscription_status?: unknown; owner_id?: string } }>) {
			const team = membership.team;
			if (!team) continue;

			let teamTier = team?.subscription_tier as SubscriptionTier | undefined;
			let teamStatus = typeof team?.subscription_status === "string" ? team.subscription_status : null;

			// Company tier: prefer team.subscription_tier, but fall back to owner's user subscription
			// (Stripe updates users table, not teams - so owner's paid tier is the source of truth)
			if ((!teamTier || teamTier === "free") && team.owner_id) {
				const { data: ownerUser } = await (supabase.from("users") as any)
					.select("subscription_tier, subscription_status")
					.eq("id", team.owner_id)
					.maybeSingle();
				if (ownerUser?.subscription_tier && ownerUser.subscription_status === "active") {
					teamTier = ownerUser.subscription_tier as SubscriptionTier;
					teamStatus = ownerUser.subscription_status;
				}
			}

			const tierIsValid = teamTier && Object.prototype.hasOwnProperty.call(TIER_PRIORITY, teamTier);
			const statusIsActive = teamStatus === "active" || teamStatus === "trialing";

			if (!tierIsValid || !statusIsActive) continue;

			highestTier = highestTier ? maxTier(highestTier, teamTier) : teamTier;
		}

		return highestTier;
	} catch {
		return null;
	}
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
	const supabase = await createClient();
	const highestTeamTier = await getHighestTeamTier(supabase, userId);

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

		const effectiveTier = highestTeamTier ? maxTier("free", highestTeamTier) : "free";

		return {
			tier: "free",
			effectiveTier,
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
	const userEffectiveTier = getEffectiveTier(tier, trialEnd);
	const effectiveTier = highestTeamTier ? maxTier(userEffectiveTier, highestTeamTier) : userEffectiveTier;

	return {
		tier,
		effectiveTier,
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
			lead_generator: "Lead Generator + Route Planner",
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
