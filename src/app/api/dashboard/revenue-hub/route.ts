import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: Fetch revenue hub enhanced stats with trends
export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
		const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
		const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString();
		const prevMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59).toISOString();

		const [
			allLeadsResult,
			closedThisMonthResult,
			closedLastMonthResult,
			activitiesThisMonthResult,
			activitiesLastMonthResult,
			recentActivityResult,
			goalsResult,
			snapshotsResult,
			funnelResult,
			overdueResult,
			hailAlertsResult,
			todayActivitiesResult,
		] = await Promise.all([
			// All leads with status
			supabase
				.from("leads")
				.select("id, status, estimated_claim, lead_score, address, city, state, updated_at, created_at, last_contact, phone, latitude, longitude, storm_proximity_score, roof_age_score, roof_size_score, property_value_score, hail_history_score, roof_age, year_built, square_feet, assessed_value, source, notes")
				.or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
				.order("lead_score", { ascending: false }),

			// Closed deals this month
			supabase
				.from("leads")
				.select("estimated_claim, status_changed_at")
				.eq("user_id", user.id)
				.eq("status", "closed")
				.gte("status_changed_at", monthStart),

			// Closed deals last month (for comparison)
			supabase
				.from("leads")
				.select("estimated_claim")
				.eq("user_id", user.id)
				.eq("status", "closed")
				.gte("status_changed_at", prevMonthStart)
				.lte("status_changed_at", prevMonthEnd),

			// Activities this month
			supabase
				.from("activities")
				.select("activity_type, created_at")
				.eq("user_id", user.id)
				.gte("created_at", monthStart),

			// Activities last month
			supabase
				.from("activities")
				.select("activity_type")
				.eq("user_id", user.id)
				.gte("created_at", prevMonthStart)
				.lte("created_at", prevMonthEnd),

			// Recent activities
			supabase
				.from("activities")
				.select(`id, activity_type, title, description, outcome, created_at, leads (id, address, city)`)
				.eq("user_id", user.id)
				.order("created_at", { ascending: false })
				.limit(10),

			// User goals
			supabase
				.from("user_goals")
				.select("*")
				.eq("user_id", user.id)
				.order("month", { ascending: false })
				.limit(1)
				.maybeSingle(),

			// Revenue snapshots (last 30 days)
			supabase
				.from("revenue_snapshots")
				.select("*")
				.eq("user_id", user.id)
				.gte("snapshot_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
				.order("snapshot_date", { ascending: true }),

			// Conversion funnel
			// @ts-expect-error - RPC types not yet generated
			supabase.rpc("get_conversion_funnel", { p_user_id: user.id, p_days_back: 90 }).then((res: any) => res).catch(() => ({ data: null, error: 'rpc not found' })),

			// Overdue follow-ups (leads with no activity in 5+ days, not closed/lost)
			supabase
				.from("leads")
				.select("id, address, city, state, lead_score, status, updated_at, estimated_claim, phone")
				.eq("user_id", user.id)
				.not("status", "in", '("closed","lost")')
				.lt("updated_at", new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString())
				.order("lead_score", { ascending: false })
				.limit(10),

			// Hail alerts
			supabase
				.from("user_settings")
				.select("default_latitude, default_longitude")
				.eq("user_id", user.id)
				.single(),

			// Today's activities count
			supabase
				.from("activities")
				.select("activity_type")
				.eq("user_id", user.id)
				.gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toISOString()),
		]);

		// ─── Process Leads ───
		const allLeads = (allLeadsResult.data || []) as any[];
		const activeLeads = allLeads.filter((l: any) => !["closed", "lost"].includes(l.status));
		const pipelineValue = activeLeads.reduce((sum: number, l: any) => sum + (parseFloat(l.estimated_claim) || 0), 0);
		const closedDeals = allLeads.filter((l: any) => l.status === "closed");
		const totalClosedValue = closedDeals.reduce((sum: number, l: any) => sum + (parseFloat(l.estimated_claim) || 0), 0);
		const avgDealSize = closedDeals.length > 0 ? totalClosedValue / closedDeals.length : 0;
		const totalOpportunities = allLeads.filter((l: any) => l.status !== "new" && l.status !== "lost").length;
		const closeRate = totalOpportunities > 0 ? Math.round((closedDeals.length / totalOpportunities) * 100) : 0;
		
		// Pipeline breakdown
		const pipeline: Record<string, number> = { new: 0, contacted: 0, appointment_set: 0, inspected: 0, signed: 0, closed: 0, lost: 0 };
		allLeads.forEach((l: any) => { if (pipeline[l.status] !== undefined) pipeline[l.status]++; });

		// ─── This Month vs Last Month ───
		const closedThisMonth = (closedThisMonthResult.data || []) as any[];
		const closedValueThisMonth = closedThisMonth.reduce((sum: number, l: any) => sum + (parseFloat(l.estimated_claim) || 0), 0);
		const closedLastMonth = (closedLastMonthResult.data || []) as any[];
		const closedValueLastMonth = closedLastMonth.reduce((sum: number, l: any) => sum + (parseFloat(l.estimated_claim) || 0), 0);
		const revenueChangePercent = closedValueLastMonth > 0
			? Math.round(((closedValueThisMonth - closedValueLastMonth) / closedValueLastMonth) * 100)
			: closedValueThisMonth > 0 ? 100 : 0;

		// ─── Activities ───
		const activitiesThisMonth = (activitiesThisMonthResult.data || []) as any[];
		const activitiesLastMonth = (activitiesLastMonthResult.data || []) as any[];
		const activityCounts = {
			doorKnocks: activitiesThisMonth.filter((a: any) => a.activity_type === "door_knock").length,
			phoneCalls: activitiesThisMonth.filter((a: any) => a.activity_type === "phone_call").length,
			appointmentsSet: activitiesThisMonth.filter((a: any) => a.activity_type === "appointment_set").length,
			inspections: activitiesThisMonth.filter((a: any) => a.activity_type === "inspection").length,
			estimatesSent: activitiesThisMonth.filter((a: any) => a.activity_type === "estimate_sent").length,
			dealsClosedActivity: activitiesThisMonth.filter((a: any) => a.activity_type === "contract_signed").length,
		};
		const totalActivitiesThisMonth = activitiesThisMonth.length;
		const totalActivitiesLastMonth = activitiesLastMonth.length;
		const activityChangePercent = totalActivitiesLastMonth > 0
			? Math.round(((totalActivitiesThisMonth - totalActivitiesLastMonth) / totalActivitiesLastMonth) * 100)
			: totalActivitiesThisMonth > 0 ? 100 : 0;

		// Today's activity counts
		const todayActivities = (todayActivitiesResult.data || []) as any[];
		const todayCounts = {
			doorKnocks: todayActivities.filter((a: any) => a.activity_type === "door_knock").length,
			phoneCalls: todayActivities.filter((a: any) => a.activity_type === "phone_call").length,
			appointments: todayActivities.filter((a: any) => a.activity_type === "appointment_set").length,
			totalToday: todayActivities.length,
		};

		// ─── Hot Leads with Scoring Reason ───
		const hotLeads = allLeads
			.filter((l: any) => l.lead_score >= 50 && !["closed", "lost"].includes(l.status))
			.slice(0, 10)
			.map((l: any) => ({
				...l,
				score_reasons: buildScoreReasons(l),
			}));

		// ─── Weighted Pipeline (probability by stage) ───
		const stageWeights: Record<string, number> = {
			new: 0.05,
			contacted: 0.15,
			appointment_set: 0.30,
			inspected: 0.50,
			signed: 0.80,
		};
		const weightedPipeline = activeLeads.reduce((sum: number, l: any) => {
			const weight = stageWeights[l.status] || 0.1;
			return sum + ((parseFloat(l.estimated_claim) || 0) * weight);
		}, 0);

		// ─── Goals ───
		const goals = goalsResult.data || {
			monthly_revenue_goal: 25000,
			commission_rate: 0.10,
			daily_door_knock_goal: 30,
			daily_call_goal: 20,
			weekly_appointment_goal: 10,
			monthly_deal_goal: 4,
		};

		const commissionEarned = closedValueThisMonth * (goals.commission_rate || 0.10);

		// ─── Revenue Projection ───
		const dayOfMonth = new Date().getDate();
		const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
		const projectedRevenue = dayOfMonth > 0 ? (closedValueThisMonth / dayOfMonth) * daysInMonth : 0;

		// ─── Streak Calculation ───
		let closingStreak = 0;
		let daysSinceLastClose = 0;
		if (closedThisMonth.length > 0) {
			const sorted = closedThisMonth
				.filter((c: any) => c.status_changed_at)
				.sort((a: any, b: any) => new Date(b.status_changed_at).getTime() - new Date(a.status_changed_at).getTime());
			if (sorted.length > 0) {
				daysSinceLastClose = Math.floor((Date.now() - new Date(sorted[0].status_changed_at).getTime()) / (1000 * 60 * 60 * 24));
				// Count consecutive days with closes
				let lastDate: string | null = null;
				for (const deal of sorted) {
					const dealDate = new Date(deal.status_changed_at).toISOString().split("T")[0];
					if (lastDate === null || lastDate !== dealDate) {
						closingStreak++;
						lastDate = dealDate;
					}
				}
			}
		}

		// ─── Hail Alerts ───
		let hailAlerts: any[] = [];
		const userSettings = hailAlertsResult.data as any;
		if (userSettings?.default_latitude && userSettings?.default_longitude) {
			try {
				// @ts-expect-error - RPC function types not yet generated
				const { data: hailData } = await supabase.rpc("find_nearby_hail_events", {
					p_latitude: userSettings.default_latitude,
					p_longitude: userSettings.default_longitude,
					p_radius_miles: 50,
					p_days_back: 7,
				});
				hailAlerts = (hailData || []).slice(0, 5);
			} catch {
				// hail RPC may not exist yet
			}
		}

		// ─── Conversion Funnel ───
		const funnel = funnelResult?.data || [];

		// ─── Overdue Follow-ups ───
		const overdue = (overdueResult.data || []).map((l: any) => ({
			...l,
			days_overdue: Math.floor((Date.now() - new Date(l.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
			revenue_at_risk: parseFloat(l.estimated_claim) || 0,
		}));

		// ─── Snapshot Revenue Trend (build if not enough snapshots) ───
		const snapshots = (snapshotsResult.data || []) as any[];
		
		// Also snapshot today's data
		try {
			// @ts-expect-error - RPC types not yet generated
			await supabase.rpc("snapshot_daily_revenue", { p_user_id: user.id }).catch(() => {});
		} catch {
			// snapshot function may not exist yet
		}

		// ─── Build Response ───
		return NextResponse.json({
			success: true,
			data: {
				kpis: {
					leadsGenerated: allLeads.length,
					activeOpportunities: activeLeads.length,
					appointmentsSet: activityCounts.appointmentsSet,
					dealsClosed: closedThisMonth.length,
					dealsClosedAllTime: closedDeals.length,
					pipelineValue,
					weightedPipeline,
					closeRate,
					closedValue: closedValueThisMonth,
					closedValueAllTime: totalClosedValue,
					avgDealSize,
					revenueChangePercent,
					activityChangePercent,
					projectedRevenue,
					commissionEarned,
				},
				goals,
				streak: {
					closingStreak,
					daysSinceLastClose,
				},
				activitySummary: activityCounts,
				todayCounts,
				pipeline,
				funnel,
				recentActivities: recentActivityResult.data || [],
				hotLeads,
				overdue,
				hailAlerts: {
					count: hailAlerts.length,
					events: hailAlerts,
				},
				snapshots,
			},
		});
	} catch (error) {
		console.error("Revenue Hub stats error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// ─── Build human-readable scoring reasons ───
function buildScoreReasons(lead: any): string[] {
	const reasons: string[] = [];
	
	if (lead.storm_proximity_score >= 15) reasons.push("Near recent storm activity");
	if (lead.hail_history_score >= 10) reasons.push("Hail damage history");
	if (lead.roof_age_score >= 20) {
		const age = lead.roof_age || (lead.year_built ? new Date().getFullYear() - lead.year_built : null);
		if (age) reasons.push(`${age}yr old roof`);
		else reasons.push("Aging roof");
	}
	if (lead.property_value_score >= 15) {
		const val = lead.assessed_value ? `$${Math.round(lead.assessed_value / 1000)}K` : "High value";
		reasons.push(`${val} property`);
	}
	if (lead.roof_size_score >= 10) reasons.push("Large roof area");
	
	// If no scoring reasons, use generic ones
	if (reasons.length === 0) {
		if (lead.lead_score >= 80) reasons.push("High composite score");
		if (lead.status === "appointment_set") reasons.push("Appointment pending");
		if (lead.source === "ai_auto_generated") reasons.push("AI-detected opportunity");
	}
	
	return reasons;
}

// POST: Update user goals
export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

		const { error } = await (supabase
			.from("user_goals") as any)
			.upsert({
				user_id: user.id,
				month: monthStart,
				monthly_revenue_goal: body.monthly_revenue_goal,
				commission_rate: body.commission_rate,
				daily_door_knock_goal: body.daily_door_knock_goal,
				daily_call_goal: body.daily_call_goal,
				weekly_appointment_goal: body.weekly_appointment_goal,
				monthly_deal_goal: body.monthly_deal_goal,
				updated_at: new Date().toISOString(),
			}, { onConflict: "user_id,month" });

		if (error) throw error;

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Update goals error:", error);
		return NextResponse.json({ error: "Failed to update goals" }, { status: 500 });
	}
}
