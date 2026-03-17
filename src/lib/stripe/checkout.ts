import { stripe } from "@/lib/stripe/client";
import { stripeConfig, getPriceIdForTier, type SubscriptionPriceTier } from "@/lib/stripe/config";
import type { Database } from "@/types/database";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

export async function createSubscriptionCheckoutSession(input: {
	userId: string;
	email: string;
	userRecord: UserRow | null;
	tier?: SubscriptionPriceTier;
	teamId?: string | null;
	appUrl?: string;
	upsertUser: (payload: Database["public"]["Tables"]["users"]["Update"] & { id: string }) => Promise<void>;
}) {
	const tier = input.tier ?? "pro";
	const priceId = getPriceIdForTier(tier);
	
	if (!priceId) {
		throw new Error(`No price ID configured for tier: ${tier}`);
	}
	
	let customerId = input.userRecord?.stripe_customer_id ?? null;

	if (!customerId) {
		const customer = await stripe.customers.create({
			email: input.email,
			metadata: {
				userId: input.userId
			}
		});

		customerId = customer.id;
		await input.upsertUser({
			id: input.userId,
			email: input.email,
			stripe_customer_id: customerId,
			subscription_status: input.userRecord?.subscription_status ?? "inactive"
		});
	}

	// Map checkout tier to subscription tier for metadata
	const subscriptionTier = tier;

	const session = await stripe.checkout.sessions.create({
		mode: "subscription",
		client_reference_id: input.userId,
		customer: customerId,
		line_items: [
			{
				price: priceId,
				quantity: 1
			}
		],
		success_url: `${input.appUrl ?? stripeConfig.stripeAppUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${input.appUrl ?? stripeConfig.stripeAppUrl}/settings/billing?billing=cancelled`,
		allow_promotion_codes: true,
		subscription_data: {
			trial_period_days: 7,
			metadata: {
				userId: input.userId,
				user_id: input.userId,
				tier: subscriptionTier,
				team_id: input.teamId ?? ""
			}
		},
		metadata: {
			userId: input.userId,
			user_id: input.userId,
			tier: subscriptionTier,
			team_id: input.teamId ?? ""
		}
	});

	return session;
}
