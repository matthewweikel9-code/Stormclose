import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserSubscription } from "@/lib/subscriptions/access";
import { PartnerEngineTabs } from "@/components/partner-engine/PartnerEngineTabs";

export default async function PartnerEngineLayout({
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

	return <PartnerEngineTabs>{children}</PartnerEngineTabs>;
}
