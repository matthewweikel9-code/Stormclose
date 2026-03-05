import { createAdminClient } from "@/lib/supabase/admin";

export function normalizeSubscriptionStatus(status: string | null | undefined) {
	if (!status) {
		return "inactive";
	}

	if (status === "active" || status === "trialing") {
		return "active";
	}

	return status;
}

export async function updateUserSubscriptionByCustomerId(input: {
	customerId: string;
	status: string | null | undefined;
}) {
	const admin = createAdminClient();
	await (admin
		.from("users") as any)
		.update({
			subscription_status: normalizeSubscriptionStatus(input.status)
		})
		.eq("stripe_customer_id", input.customerId);
}

export async function updateUserSubscriptionByUserId(input: {
	userId: string;
	customerId?: string | null;
	status: string | null | undefined;
}) {
	const admin = createAdminClient();
	await (admin.from("users") as any).upsert(
		{
			id: input.userId,
			stripe_customer_id: input.customerId ?? null,
			subscription_status: normalizeSubscriptionStatus(input.status)
		},
		{ onConflict: "id" }
	);
}
