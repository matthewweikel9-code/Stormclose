// Subscription tier types and configuration

export type SubscriptionTier = "free" | "pro" | "pro_plus" | "enterprise" | "trial";

export type FeatureKey =
	| "objection_handler"
	| "supplement_generator"
	| "negotiation_coach"
	| "carrier_intelligence"
	| "lead_scoring"
	| "roof_measurement";

export interface TierLimits {
	features: FeatureKey[];
}

export const TIER_CONFIG: Record<SubscriptionTier, TierLimits> = {
	free: {
		features: []
	},
	trial: {
		features: ["objection_handler"]
	},
	pro: {
		features: ["objection_handler"]
	},
	pro_plus: {
		features: [
			"objection_handler",
			"supplement_generator",
			"negotiation_coach"
		]
	},
	enterprise: {
		features: [
			"objection_handler",
			"supplement_generator",
			"negotiation_coach",
			"carrier_intelligence",
			"lead_scoring",
			"roof_measurement"
		]
	}
};

export const TIER_DISPLAY_NAMES: Record<SubscriptionTier, string> = {
	free: "Free",
	pro: "Pro",
	pro_plus: "Pro+",
	enterprise: "Enterprise",
	trial: "Trial"
};

export const TIER_PRICES: Record<Exclude<SubscriptionTier, "free" | "trial">, number> = {
	pro: 99,
	pro_plus: 249,
	enterprise: 499
};

export const FEATURE_DISPLAY_NAMES: Record<FeatureKey, string> = {
	objection_handler: "Objection Response AI",
	supplement_generator: "Automated Supplement Generation",
	negotiation_coach: "AI Insurance Negotiation Coach",
	carrier_intelligence: "Insurance Carrier Intelligence",
	lead_scoring: "Predictive Lead Scoring",
	roof_measurement: "Instant Roof Measurement AI"
};

export function hasFeature(tier: SubscriptionTier, feature: FeatureKey): boolean {
	return TIER_CONFIG[tier]?.features.includes(feature) ?? false;
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
