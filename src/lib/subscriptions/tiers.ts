// Subscription tier types and configuration

export type SubscriptionTier = "free" | "pro" | "pro_plus" | "trial";

export type FeatureKey =
	| "reports"
	| "csv_upload"
	| "email_generation"
	| "objection_handler"
	| "photo_analysis"
	| "priority_templates";

export interface TierLimits {
	reportsPerMonth: number | "unlimited";
	features: FeatureKey[];
}

export const TIER_CONFIG: Record<SubscriptionTier, TierLimits> = {
	free: {
		reportsPerMonth: 2,
		features: ["reports"]
	},
	pro: {
		reportsPerMonth: "unlimited",
		features: ["reports", "csv_upload", "email_generation"]
	},
	pro_plus: {
		reportsPerMonth: "unlimited",
		features: [
			"reports",
			"csv_upload",
			"email_generation",
			"objection_handler",
			"photo_analysis",
			"priority_templates"
		]
	},
	trial: {
		reportsPerMonth: "unlimited",
		features: ["reports", "csv_upload", "email_generation"]
	}
};

export const TIER_DISPLAY_NAMES: Record<SubscriptionTier, string> = {
	free: "Free",
	pro: "Pro",
	pro_plus: "Pro+",
	trial: "Trial"
};

export const TIER_PRICES: Record<Exclude<SubscriptionTier, "free" | "trial">, number> = {
	pro: 49,
	pro_plus: 99
};

export function hasFeature(tier: SubscriptionTier, feature: FeatureKey): boolean {
	return TIER_CONFIG[tier]?.features.includes(feature) ?? false;
}

export function getReportLimit(tier: SubscriptionTier): number | "unlimited" {
	return TIER_CONFIG[tier]?.reportsPerMonth ?? 2;
}

export function canGenerateReport(
	tier: SubscriptionTier,
	reportsThisMonth: number
): { allowed: boolean; reason?: string } {
	const limit = getReportLimit(tier);

	if (limit === "unlimited") {
		return { allowed: true };
	}

	if (reportsThisMonth >= limit) {
		return {
			allowed: false,
			reason: `You've reached your limit of ${limit} reports this month. Upgrade to Pro for unlimited reports.`
		};
	}

	return { allowed: true };
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
