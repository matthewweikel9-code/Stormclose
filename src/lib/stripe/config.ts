export const stripeConfig = {
	secretKey: process.env.STRIPE_SECRET_KEY ?? "",
	webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
	monthlyPriceId: process.env.STRIPE_PRICE_ID_MONTHLY ?? "",
	appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
};
