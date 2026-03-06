import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getEffectiveTier, type SubscriptionTier } from "@/lib/subscriptions";

export default async function DashboardLayout({
	children
}: {
	children: React.ReactNode;
}) {
	const supabase = await createClient();
	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const { data: accountData } = (await supabase
		.from("users")
		.select("subscription_status, subscription_tier, trial_end, reports_this_month")
		.eq("id", user.id)
		.maybeSingle()) as { 
			data: { 
				subscription_status: string | null;
				subscription_tier: SubscriptionTier | null;
				trial_end: string | null;
				reports_this_month: number | null;
			} | null 
		};

	const subscriptionStatus = accountData?.subscription_status ?? "inactive";
	const tier = (accountData?.subscription_tier as SubscriptionTier) ?? "free";
	const effectiveTier = getEffectiveTier(tier, accountData?.trial_end ?? null);
	const reportsThisMonth = accountData?.reports_this_month ?? 0;
	const trialEnd = accountData?.trial_end ?? null;

	return (
		<DashboardShell 
			user={user} 
			subscriptionStatus={subscriptionStatus}
			tier={effectiveTier}
			reportsThisMonth={reportsThisMonth}
			trialEnd={trialEnd}
		>
			{children}
		</DashboardShell>
	);
}
