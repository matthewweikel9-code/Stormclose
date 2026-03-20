import { createClient } from "@/lib/supabase/server";
import { MissionsHub } from "./missions-hub";

export default async function MissionsPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return null;
	}

	const { data: profile } = await (supabase.from("users") as any)
		.select("role")
		.eq("id", user.id)
		.maybeSingle();

	return (
		<MissionsHub metadataRole={profile?.role ?? null} />
	);
}
