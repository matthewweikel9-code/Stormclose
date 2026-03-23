/**
 * GET /api/dashboard/storm-roi
 * Phase 6: Executive ROI dashboard — honest proxies for boardroom
 * doors, opportunities surfaced, supplements assisted, exports to JN
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWriteTeamIdForUser } from "@/lib/server/tenant";

export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const teamId = await resolveWriteTeamIdForUser(supabase, user.id, null);
	const days = Math.min(parseInt(new URL(request.url).searchParams.get("days") ?? "30", 10) || 30, 90);
	const start = new Date();
	start.setDate(start.getDate() - days);

	try {
		const [
			missionsRes,
			exportsRes,
			supplementsRes,
			leadsRes,
			pipelineRes,
		] = await Promise.all([
			// Mission stats (doors, routes)
			(supabase as any)
				.from("canvass_missions")
				.select("stops_knocked, appointments_set, leads_created, estimated_pipeline, actual_pipeline")
				.eq("user_id", user.id)
				.gte("created_at", start.toISOString()),
			// Exports to JobNimbus
			(supabase as any)
				.from("lead_exports")
				.select("id")
				.eq("user_id", user.id)
				.eq("destination", "jobnimbus")
				.gte("created_at", start.toISOString()),
			// Supplements (ai_usage or feature_usage)
			(supabase as any)
				.from("ai_usage_records")
				.select("id")
				.eq("user_id", user.id)
				.in("feature", ["supplement", "supplement_unified", "xactimate_analyze"])
				.gte("created_at", start.toISOString().split("T")[0]),
			// Leads surfaced (opportunities)
			(supabase as any)
				.from("leads")
				.select("id, estimated_claim, lead_score, status, source")
				.eq("user_id", user.id)
				.gte("created_at", start.toISOString()),
			// Pipeline value
			(supabase as any)
				.from("leads")
				.select("estimated_claim, actual_claim, status")
				.eq("user_id", user.id)
				.in("status", ["closed", "signed", "appointment_set", "inspected"]),
		]);

		const missions = missionsRes.data ?? [];
		const exports = exportsRes.data ?? [];
		const supplements = supplementsRes.data ?? [];
		const leads = leadsRes.data ?? [];
		const pipeline = pipelineRes.data ?? [];

		const totalDoors = missions.reduce((s: number, m: any) => s + (m.stops_knocked ?? 0), 0);
		const totalAppointments = missions.reduce((s: number, m: any) => s + (m.appointments_set ?? 0), 0);
		const totalOpportunityValue = leads.reduce((s: number, l: any) => s + (Number(l.estimated_claim) || 0), 0);
		const closedValue = pipeline
			.filter((l: any) => l.status === "closed")
			.reduce((s: number, l: any) => s + (Number(l.actual_claim) || Number(l.estimated_claim) || 0), 0);

		return NextResponse.json({
			success: true,
			period: { days, start: start.toISOString() },
			metrics: {
				doorsKnocked: totalDoors,
				appointmentsSet: totalAppointments,
				opportunitiesSurfaced: leads.length,
				opportunityValue: totalOpportunityValue,
				supplementsAssisted: supplements.length,
				exportsToJobNimbus: exports.length,
				closedRevenue: closedValue,
			},
			summary: {
				message: `Over ${days} days: ${totalDoors} doors, ${leads.length} opportunities surfaced, ${supplements.length} supplements assisted, ${exports.length} exports to JobNimbus. Closed: $${closedValue.toLocaleString()}.`,
			},
		});
	} catch (error) {
		console.error("[Storm ROI] Error:", error);
		return NextResponse.json(
			{ error: "Failed to compute ROI metrics" },
			{ status: 500 }
		);
	}
}
