import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Types for dashboard data (until Supabase types are regenerated)
interface Activity {
	activity_type: string;
	id?: string;
	title?: string;
	description?: string;
	outcome?: string;
	created_at?: string;
	leads?: { id: string; address: string; city: string };
}

interface Lead {
	id: string;
	status: string;
	estimated_claim: string | number;
	lead_score?: number;
	address?: string;
	city?: string;
}

interface UserSettings {
	default_latitude: number;
	default_longitude: number;
}

// GET: Fetch dashboard stats and KPIs
export async function GET(request: NextRequest) {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const searchParams = request.nextUrl.searchParams;
	const period = searchParams.get("period") || "week"; // day, week, month, all

	// Calculate date range
	const now = new Date();
	let startDate: Date;

	switch (period) {
		case "day":
			startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			break;
		case "week":
			startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
			break;
		case "month":
			startDate = new Date(now.getFullYear(), now.getMonth(), 1);
			break;
		default:
			startDate = new Date(0); // All time
	}

	const startDateStr = startDate.toISOString();

	try {
		// Fetch all stats in parallel
		const [
			leadsResult,
			activitiesResult,
			pipelineResult,
			recentActivityResult,
			hotLeadsResult,
			hailAlertsResult,
		] = await Promise.all([
			// Total leads count
			supabase
				.from("leads")
				.select("*", { count: "exact", head: true })
				.eq("user_id", user.id)
				.gte("created_at", startDateStr),

			// Activities breakdown
			supabase
				.from("activities")
				.select("activity_type")
				.eq("user_id", user.id)
				.gte("created_at", startDateStr),

			// Pipeline status counts
			supabase.from("leads").select("status, estimated_claim").eq("user_id", user.id),

			// Recent activities (last 10)
			supabase
				.from("activities")
				.select(
					`
					id,
					activity_type,
					title,
					description,
					outcome,
					created_at,
					leads (
						id,
						address,
						city
					)
				`
				)
				.eq("user_id", user.id)
				.order("created_at", { ascending: false })
				.limit(10),

			// Hot leads (top scored)
			supabase
				.from("leads")
				.select("*")
				.eq("user_id", user.id)
				.in("status", ["new", "contacted", "appointment_set"])
				.order("lead_score", { ascending: false })
				.limit(5),

			// Recent hail events near user (if they have a default location)
			supabase
				.from("user_settings")
				.select("default_latitude, default_longitude")
				.eq("user_id", user.id)
				.single(),
		]);

		// Process activities
		const activities = (activitiesResult.data || []) as Activity[];
		const activityCounts = {
			doorKnocks: activities.filter((a) => a.activity_type === "door_knock").length,
			phoneCalls: activities.filter((a) => a.activity_type === "phone_call").length,
			appointmentsSet: activities.filter((a) => a.activity_type === "appointment_set").length,
			inspections: activities.filter((a) => a.activity_type === "inspection").length,
		};

		// Process pipeline
		const pipeline = (pipelineResult.data || []) as Lead[];
		const pipelineCounts = {
			new: 0,
			contacted: 0,
			appointment_set: 0,
			inspected: 0,
			signed: 0,
			closed: 0,
			lost: 0,
		};
		let totalPipelineValue = 0;
		let closedValue = 0;

		pipeline.forEach((lead) => {
			const status = lead.status as keyof typeof pipelineCounts;
			if (pipelineCounts[status] !== undefined) {
				pipelineCounts[status]++;
			}

			const value = parseFloat(String(lead.estimated_claim)) || 0;
			if (lead.status !== "closed" && lead.status !== "lost") {
				totalPipelineValue += value;
			}
			if (lead.status === "closed") {
				closedValue += value;
			}
		});

		// Calculate close rate
		const totalOpportunities = pipeline.filter((l: Lead) => l.status !== "new").length;
		const closedDeals = pipelineCounts.closed;
		const closeRate = totalOpportunities > 0 ? Math.round((closedDeals / totalOpportunities) * 100) : 0;

		// Fetch hail alerts if user has location
		let recentHailEvents: Array<{
			event_date: string;
			location_name: string;
			state: string;
			size_inches: number;
			distance_miles: number;
		}> = [];

		const userSettings = hailAlertsResult.data as UserSettings | null;
		if (userSettings?.default_latitude && userSettings?.default_longitude) {
			// @ts-expect-error - RPC function types not yet generated
			const { data: hailData } = await supabase.rpc("find_nearby_hail_events", {
				p_latitude: userSettings.default_latitude,
				p_longitude: userSettings.default_longitude,
				p_radius_miles: 50,
				p_days_back: 7,
			});
			recentHailEvents = (hailData as unknown as typeof recentHailEvents) || [];
		}

		// Build response
		const dashboardData = {
			kpis: {
				leadsGenerated: leadsResult.count || 0,
				appointmentsSet: activityCounts.appointmentsSet,
				dealsClosed: closedDeals,
				pipelineValue: totalPipelineValue,
				closeRate,
				closedValue,
			},
			activitySummary: activityCounts,
			pipeline: pipelineCounts,
			recentActivities: recentActivityResult.data || [],
			hotLeads: hotLeadsResult.data || [],
			hailAlerts: {
				count: recentHailEvents.length,
				events: recentHailEvents.slice(0, 5), // Top 5 recent
			},
			period,
		};

		return NextResponse.json({
			success: true,
			data: dashboardData,
		});
	} catch (error) {
		console.error("Dashboard stats error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
