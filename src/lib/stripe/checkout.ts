import { stripe } from "@/lib/stripe/client";
import { stripeConfig } from "@/lib/stripe/config";
import type { Database } from "@/types/database";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

export async function createSubscriptionCheckoutSession(input: {
	userId: string;
	email: string;
	userRecord: UserRow | null;
	appUrl?: string;
	upsertUser: (payload: Database["public"]["Tables"]["users"]["Update"] & { id: string }) => Promise<void>;
}) {
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

	const session = await stripe.checkout.sessions.create({
		mode: "subscription",
		client_reference_id: input.userId,
		customer: customerId,
		line_items: [
			{
				price: stripeConfig.monthlyPriceId,
				quantity: 1
			}
		],
		success_url: `${input.appUrl ?? stripeConfig.stripeAppUrl}/dashboard?billing=success`,
		cancel_url: `${input.appUrl ?? stripeConfig.stripeAppUrl}/subscribe?billing=cancelled`,
		allow_promotion_codes: true,
		subscription_data: {
			metadata: {
				userId: input.userId
			}
		},
		metadata: {
			userId: input.userId
		}
	});

	return session;
}
