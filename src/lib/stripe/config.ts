function normalizeBaseUrl(url: string) {
	return url.replace(/\/$/, "");
}

const defaultAppUrl = "http://localhost:3000";
const appUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL ?? defaultAppUrl);
const stripeAppUrl = normalizeBaseUrl(process.env.STRIPE_APP_URL ?? appUrl);

export const stripeConfig = {
	secretKey: process.env.STRIPE_SECRET_KEY ?? "",
	webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
	monthlyPriceId: process.env.STRIPE_PRICE_ID_MONTHLY ?? "",
	appUrl,
	stripeAppUrl
};
