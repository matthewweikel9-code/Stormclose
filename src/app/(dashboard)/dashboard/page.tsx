import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage() {
	const supabase = await createClient();
	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const { data: accountData } = (await supabase
		.from("users")
		.select("subscription_status, subscription_tier")
		.eq("id", user.id)
		.maybeSingle()) as { data: { subscription_status: string | null; subscription_tier: string | null } | null };

	const subscriptionStatus = accountData?.subscription_status ?? "inactive";
	const subscriptionTier = (accountData?.subscription_tier as "free" | "pro" | "pro_plus") ?? "free";

	return (
		<DashboardContent
			user={user}
			subscriptionStatus={subscriptionStatus}
			subscriptionTier={subscriptionTier}
			logoutAction={logout}
		/>
	);
}
