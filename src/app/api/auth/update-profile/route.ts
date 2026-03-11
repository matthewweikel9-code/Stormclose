import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user }, error: authError } = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();

		// Update user metadata in Supabase Auth
		const { error: updateError } = await supabase.auth.updateUser({
			data: {
				...user.user_metadata,
				...body,
			},
		});

		if (updateError) {
			console.error("Error updating profile:", updateError);
			return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error updating profile:", error);
		return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
	}
}
