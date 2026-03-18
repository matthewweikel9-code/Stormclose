import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getUserSubscription } from "@/lib/subscriptions/access";

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

	const subscription = await getUserSubscription(user.id);
	const { data: accountData } = (await supabase
		.from("users")
		.select("subscription_status, trial_end")
		.eq("id", user.id)
		.maybeSingle()) as {
			data: { subscription_status: string | null; trial_end: string | null } | null;
		};

	const subscriptionStatus = accountData?.subscription_status ?? "inactive";
	const effectiveTier = subscription?.effectiveTier ?? "free";
	const trialEnd = subscription?.trialEnd ?? accountData?.trial_end ?? null;

	return (
		<DashboardShell
			user={user}
			subscriptionStatus={subscriptionStatus}
			tier={effectiveTier}
			trialEnd={trialEnd}
		>
			{children}
		</DashboardShell>
	);
}
