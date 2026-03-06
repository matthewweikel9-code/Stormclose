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
		.select("subscription_status")
		.eq("id", user.id)
		.maybeSingle()) as { data: { subscription_status: string | null } | null };

	const subscriptionStatus = accountData?.subscription_status ?? "inactive";

	return (
		<DashboardContent
			user={user}
			subscriptionStatus={subscriptionStatus}
			logoutAction={logout}
		/>
	);
}
