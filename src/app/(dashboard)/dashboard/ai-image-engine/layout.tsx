import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions/access";

export default async function AIImageEngineLayout({
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

	const access = await checkFeatureAccess(user.id, "lead_generator");

	if (!access.allowed) {
		redirect("/settings/billing?upgrade=pro");
	}

	return <>{children}</>;
}
