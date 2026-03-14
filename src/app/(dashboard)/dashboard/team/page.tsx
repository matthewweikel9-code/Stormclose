import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeamHub } from "./team-hub";

export default function TeamPage() {
	return <TeamPageContent />;
}

async function TeamPageContent() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const metadataRole = typeof user.user_metadata?.role === "string" ? user.user_metadata.role : null;
	return <TeamHub metadataRole={metadataRole} />;
}
