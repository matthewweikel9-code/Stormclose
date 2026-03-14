import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardV2 } from "./dashboard-v2";

export default async function DashboardPage() {
	const supabase = await createClient();
	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const metadataRole = typeof user.user_metadata?.role === "string" ? user.user_metadata.role : null;

	return <DashboardV2 metadataRole={metadataRole} />;
}
