import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StormCommandCenter } from "@/components/storms";

export const metadata = {
	title: "Storm Command Center | StormClose",
	description: "Track storms, generate leads, and build optimized door-knocking routes."
};

export default async function StormsPage() {
	const supabase = await createClient();
	
	const { data: { user }, error } = await supabase.auth.getUser();
	
	if (error || !user) {
		redirect("/login");
	}
	
	return (
		<div className="p-6">
			<StormCommandCenter />
		</div>
	);
}
