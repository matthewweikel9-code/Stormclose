import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MissionsHub } from "./missions-hub";

export default function MissionsPage() {
	return <MissionsPageContent />;
}

async function MissionsPageContent() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const metadataRole = typeof user.user_metadata?.role === "string" ? user.user_metadata.role : null;
	return <MissionsHub metadataRole={metadataRole} />;
}
