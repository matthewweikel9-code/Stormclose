// PATCH /api/storms/leads/[leadId] - Update a lead
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
	request: NextRequest,
	{ params }: { params: { leadId: string } }
) {
	try {
		const supabase = await createClient() as any;
		
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		
		const { leadId } = params;
		const body = await request.json();
		
		// Build update object (only include provided fields)
		const updates: Record<string, any> = { updated_at: new Date().toISOString() };
		
		if (body.status !== undefined) updates.status = body.status;
		if (body.notes !== undefined) updates.notes = body.notes;
		if (body.ownerName !== undefined) updates.owner_name = body.ownerName;
		if (body.phone !== undefined) updates.phone = body.phone;
		if (body.email !== undefined) updates.email = body.email;
		if (body.leadScore !== undefined) updates.lead_score = body.leadScore;
		if (body.leadTemperature !== undefined) updates.lead_temperature = body.leadTemperature;
		
		const { data: updated, error } = await supabase
			.from("storm_leads")
			.update(updates)
			.eq("id", leadId)
			.eq("user_id", user.id)
			.select()
			.single();
		
		if (error) {
			console.error("Error updating lead:", error);
			return NextResponse.json(
				{ error: "Failed to update lead" },
				{ status: 500 }
			);
		}
		
		if (!updated) {
			return NextResponse.json(
				{ error: "Lead not found" },
				{ status: 404 }
			);
		}
		
		return NextResponse.json({ success: true, lead: updated });
		
	} catch (error) {
		console.error("Error in PATCH /api/storms/leads/[leadId]:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: { leadId: string } }
) {
	try {
		const supabase = await createClient() as any;
		
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		
		const { leadId } = params;
		
		const { error } = await supabase
			.from("storm_leads")
			.delete()
			.eq("id", leadId)
			.eq("user_id", user.id);
		
		if (error) {
			console.error("Error deleting lead:", error);
			return NextResponse.json(
				{ error: "Failed to delete lead" },
				{ status: 500 }
			);
		}
		
		return NextResponse.json({ success: true });
		
	} catch (error) {
		console.error("Error in DELETE /api/storms/leads/[leadId]:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
