import { createClient } from "@/lib/supabase/server";
import type { SubscriptionTier, FeatureKey } from "./tiers";
import { hasFeature, getEffectiveTier, canGenerateReport, getDaysRemaining } from "./tiers";

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

	if (error || !data) {
		return null;
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
			reports: "Report Generation",
			csv_upload: "CSV Upload",
			email_generation: "Email Generation",
			objection_handler: "Objection Handler",
			photo_analysis: "Photo Analysis",
			priority_templates: "Priority Templates"
		};

		return {
			allowed: false,
			reason: `${featureNames[feature]} requires a higher subscription tier.`,
			tier: effectiveTier
		};
	}

	return { allowed: true, tier: effectiveTier };
}

export async function checkReportAccess(
	userId: string
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
	const subscription = await getUserSubscription(userId);

	if (!subscription) {
		return { allowed: false, reason: "User not found" };
	}

	const result = canGenerateReport(subscription.effectiveTier, subscription.reportsThisMonth);

	if (!result.allowed) {
		return result;
	}

	const limit =
		subscription.effectiveTier === "free" ? 2 : subscription.effectiveTier === "trial" ? 10 : -1;

	return {
		allowed: true,
		remaining: limit === -1 ? undefined : limit - subscription.reportsThisMonth
	};
}

export async function incrementReportCount(userId: string): Promise<void> {
	const supabase = await createClient();

	// Check if we need to reset the monthly count
	const { data: user } = await (supabase
		.from("users") as any)
		.select("reports_reset_at")
		.eq("id", userId)
		.maybeSingle();

	const resetAt = user?.reports_reset_at ? new Date(user.reports_reset_at) : new Date(0);
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	if (resetAt < thirtyDaysAgo) {
		// Reset the counter
		await (supabase
			.from("users") as any)
			.update({
				reports_this_month: 1,
				reports_reset_at: new Date().toISOString()
			})
			.eq("id", userId);
	} else {
		// Increment the counter - using raw SQL since rpc types are not available
		await (supabase.rpc as any)("increment_report_count", { user_id: userId });
	}
}
