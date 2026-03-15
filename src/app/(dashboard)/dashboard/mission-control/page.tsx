import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MissionControlHub } from "./mission-control-hub";

export default function MissionControlPage() {
	return <MissionControlPageContent />;
}

async function MissionControlPageContent() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	return <MissionControlHub />;
}
