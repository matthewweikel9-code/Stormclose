"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BillingContent } from "./BillingContent";

export default async function BillingPage() {
	const supabase = await createClient();
	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	// Get user subscription info
	const { data: userData } = await (supabase
		.from("users") as any)
		.select(
			"subscription_tier, subscription_status, trial_end, reports_this_month, stripe_customer_id, stripe_subscription_id"
		)
		.eq("id", user.id)
		.maybeSingle();

	return (
		<BillingContent
			user={{ id: user.id, email: user.email }}
			subscriptionData={{
				tier: userData?.subscription_tier || "free",
				status: userData?.subscription_status || "inactive",
				trialEnd: userData?.trial_end,
				reportsThisMonth: userData?.reports_this_month || 0,
				hasStripeCustomer: !!userData?.stripe_customer_id,
				hasSubscription: !!userData?.stripe_subscription_id
			}}
		/>
	);
}
