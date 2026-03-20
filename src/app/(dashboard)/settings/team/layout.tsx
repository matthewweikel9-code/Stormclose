import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserSubscription } from "@/lib/subscriptions/access";

export default async function TeamSettingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const subscription = await getUserSubscription(user.id);
	const effectiveTier = subscription?.effectiveTier ?? "free";

	if (effectiveTier !== "enterprise") {
		redirect("/settings/billing?upgrade=enterprise");
	}

	return <>{children}</>;
}
