import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: Fetch team members
export async function GET() {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get the user's team members from the teams table
		const { data: teamMembers, error } = await (supabase
			.from("team_members") as any)
			.select("*")
			.or(`user_id.eq.${user.id},invited_by.eq.${user.id}`)
			.order("created_at", { ascending: true });

		if (error) {
			// If table doesn't exist, return empty array
			console.error("Error fetching team members:", error);
			return NextResponse.json({ members: [] });
		}

		return NextResponse.json({ members: teamMembers || [] });
	} catch (error) {
		console.error("Error fetching team:", error);
		return NextResponse.json({ members: [] });
	}
}

// POST: Invite a team member
export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { email, role } = await request.json();

		if (!email) {
			return NextResponse.json({ error: "Email is required" }, { status: 400 });
		}

		// Insert into team_members table
		const { error } = await (supabase
			.from("team_members") as any)
			.insert({
				email,
				role: role || "sales_rep",
				status: "invited",
				invited_by: user.id,
				full_name: "",
				joined_at: new Date().toISOString(),
			});

		if (error) {
			console.error("Error inviting member:", error);
			return NextResponse.json({ error: "Failed to invite team member" }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error inviting team member:", error);
		return NextResponse.json({ error: "Failed to invite team member" }, { status: 500 });
	}
}

// DELETE: Remove a team member
export async function DELETE(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const id = request.nextUrl.searchParams.get("id");
		if (!id) {
			return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
		}

		const { error } = await (supabase
			.from("team_members") as any)
			.delete()
			.eq("id", id)
			.eq("invited_by", user.id);

		if (error) {
			console.error("Error removing member:", error);
			return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error removing team member:", error);
		return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 });
	}
}
