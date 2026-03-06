import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

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
		.select("subscription_status")
		.eq("id", user.id)
		.maybeSingle()) as { data: { subscription_status: string | null } | null };

	const subscriptionStatus = accountData?.subscription_status ?? "inactive";

	return (
		<DashboardShell user={user} subscriptionStatus={subscriptionStatus}>
			{children}
		</DashboardShell>
	);
}
