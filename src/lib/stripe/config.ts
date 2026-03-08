function normalizeBaseUrl(url: string) {
	return url.replace(/\/$/, "");
}

const defaultAppUrl = "http://localhost:3000";
const appUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL ?? defaultAppUrl);
const stripeAppUrl = normalizeBaseUrl(process.env.STRIPE_APP_URL ?? appUrl);

export const stripeConfig = {
	secretKey: process.env.STRIPE_SECRET_KEY ?? "",
	webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
	// Legacy monthly price - kept for backward compatibility
	monthlyPriceId: process.env.STRIPE_PRICE_ID_MONTHLY ?? "",
	// Tier-specific price IDs
	proPriceId: process.env.STRIPE_PRICE_ID_PRO ?? process.env.STRIPE_PRICE_ID_MONTHLY ?? "",
	proPlusPriceId: process.env.STRIPE_PRICE_ID_PRO_PLUS ?? "",
	enterprisePriceId: process.env.STRIPE_PRICE_ID_ENTERPRISE ?? "",
	appUrl,
	stripeAppUrl
};

export type SubscriptionPriceTier = "pro" | "pro_plus" | "enterprise";

export function getPriceIdForTier(tier: SubscriptionPriceTier): string {
	switch (tier) {
		case "pro":
			return stripeConfig.proPriceId;
		case "pro_plus":
			return stripeConfig.proPlusPriceId;
		case "enterprise":
			return stripeConfig.enterprisePriceId;
		default:
			return stripeConfig.proPriceId;
	}
}
