import Stripe from "stripe";
import {
	updateUserSubscriptionByCustomerId,
	updateUserSubscriptionByUserId
} from "@/lib/stripe/subscription";

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
	if (!customer) {
		return null;
	}

	if (typeof customer === "string") {
		return customer;
	}

	return customer.id;
}

export async function handleStripeEvent(event: Stripe.Event) {
	switch (event.type) {
		case "checkout.session.completed": {
			const session = event.data.object as Stripe.Checkout.Session;
			const customerId = getCustomerId(session.customer);
			const userId = session.metadata?.userId ?? session.client_reference_id ?? null;

			if (!userId) {
				return;
			}

			await updateUserSubscriptionByUserId({
				userId,
				customerId,
				status: "active"
			});
			return;
		}

		case "customer.subscription.created":
		case "customer.subscription.updated":
		case "customer.subscription.deleted": {
			const subscription = event.data.object as Stripe.Subscription;
			const customerId = getCustomerId(subscription.customer);

			if (!customerId) {
				return;
			}

			await updateUserSubscriptionByCustomerId({
				customerId,
				status: subscription.status
			});
			return;
		}

		default:
			return;
	}
}
