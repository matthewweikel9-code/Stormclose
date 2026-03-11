import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
	try {
		const supabase = await createClient();
		const { data: { user }, error } = await supabase.auth.getUser();

		if (error || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		return NextResponse.json({
			user: {
				id: user.id,
				email: user.email,
				user_metadata: user.user_metadata,
				created_at: user.created_at,
			},
		});
	} catch (error) {
		console.error("Error fetching user:", error);
		return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
	}
}
