// Subscription tier types and configuration

export type SubscriptionTier = "free" | "pro" | "enterprise" | "trial";

export type FeatureKey =
	| "objection_handler"
	| "supplement_generator"
	| "negotiation_coach"
	| "carrier_intelligence"
	| "lead_generator"
	| "roof_measurement";

export interface TierLimits {
	features: FeatureKey[];
}

export const TIER_CONFIG: Record<SubscriptionTier, TierLimits> = {
	free: {
		features: []
	},
	trial: {
		features: ["objection_handler", "supplement_generator", "negotiation_coach"]
	},
	pro: {
		features: [
			"objection_handler",
			"supplement_generator",
			"negotiation_coach",
			"lead_generator"
		]
	},
	enterprise: {
		features: [
			"objection_handler",
			"supplement_generator",
			"negotiation_coach",
			"carrier_intelligence",
			"lead_generator",
			"roof_measurement"
		]
	}
};

export const TIER_DISPLAY_NAMES: Record<SubscriptionTier, string> = {
	free: "Free",
	pro: "Pro",
	enterprise: "Enterprise",
	trial: "Trial"
};

export const TIER_PRICES: Record<Exclude<SubscriptionTier, "free" | "trial">, number> = {
	pro: 399,
	enterprise: 799
};

export const FEATURE_DISPLAY_NAMES: Record<FeatureKey, string> = {
	objection_handler: "Objection Response AI",
	supplement_generator: "Automated Supplement Generation",
	negotiation_coach: "AI Insurance Negotiation Coach",
	carrier_intelligence: "Insurance Carrier Intelligence",
	lead_generator: "Lead Generator + Route Planner",
	roof_measurement: "Instant Roof Measurement AI"
};

/** Marketing feature labels per tier — single source of truth for pricing/billing UI */
export const FEATURES_BY_TIER: Record<SubscriptionTier, string[]> = {
	free: [
		"Create account and explore",
		"View pricing and product overview",
		"Community support",
	],
	trial: [
		"Objection Response AI",
		"AI Negotiation Coach",
		"Supplement Generator AI",
		"AI Image Engine & Storm Ops",
		"Lead Generator + Route Planner",
		"7-day full access, then $399/mo",
		"Email support",
	],
	pro: [
		"Objection Response AI",
		"AI Negotiation Coach",
		"Supplement Generator AI",
		"AI Image Engine & Storm Ops",
		"Lead Generator + Route Planner",
		"Email support",
	],
	enterprise: [
		"Everything in Pro",
		"Carrier Intelligence Database",
		"Instant Roof Measurement AI",
		"Storm Ops command center",
		"Referral Engine",
		"Team leaderboards & GPS",
		"JobNimbus integration",
		"Dedicated support",
	],
};

/** Trial terms — used across pricing, subscribe, and checkout */
export const TRIAL_TERMS = {
	days: 7,
	cardRequired: true,
	summary: "7-day free trial on Pro or Enterprise. Card required. Cancel anytime before trial ends.",
} as const;

/** Normalize DB tier (pro_plus legacy) to current SubscriptionTier */
export function normalizeTier(tier: string | null | undefined): SubscriptionTier {
	if (!tier) return "free";
	if (tier === "pro_plus" || tier === "pro+") return "pro";
	if (["enterprise", "pro", "trial", "free"].includes(tier)) return tier as SubscriptionTier;
	return "free";
}

export function hasFeature(tier: SubscriptionTier | string, feature: FeatureKey): boolean {
	const normalized = normalizeTier(tier);
	return TIER_CONFIG[normalized]?.features.includes(feature) ?? false;
}

export function isTrialExpired(trialEnd: string | Date | null): boolean {
	if (!trialEnd) return true;
	return new Date(trialEnd) < new Date();
}

export function getEffectiveTier(
	tier: SubscriptionTier,
	trialEnd: string | Date | null
): SubscriptionTier {
	if (tier === "trial" && isTrialExpired(trialEnd)) {
		return "free";
	}
	return tier;
}

export function getDaysRemaining(trialEnd: string | Date | null): number {
	if (!trialEnd) return 0;
	const end = new Date(trialEnd);
	const now = new Date();
	const diff = end.getTime() - now.getTime();
	return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
