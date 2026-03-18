import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/utils/api-response";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type MissionControlData = {
	kpi: {
		housesToHit: number;
		activeMissions: number;
		repsInField: number;
		exportsToday: number;
	};
	team: {
		totalDoors: number;
		totalAppointments: number;
		totalLeads: number;
		totalClosed: number;
		totalRevenue: number;
		members: Array<{ id: string; name: string; revenue: number; doorsKnocked: number }>;
		topPerformer: string;
	};
	exportQueue: {
		readyCount: number;
		exportedTodayCount: number;
		failedCount: number;
		successRatePercent: number;
	};
	opportunities?: {
		totalValue: number;
		activeZones: number;
		hotLeads: number;
		stormZones: Array<{ id: string; location: string; opportunityScore: number }>;
	};
	referralEngine?: {
		partnersCount: number;
		referralsCount: number;
		closedCount: number;
		totalRevenue: number;
	};
};

export async function GET(request: NextRequest) {
	const startedAt = Date.now();
	const { log } = logger.fromRequest(request, {
		route: "/api/mission-control/live",
		method: "GET",
	});

	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			log.warn("mission_control.unauthorized");
			return errorResponse("Unauthorized", 401);
		}

		const base = request.nextUrl.origin;
		const cookie = request.headers.get("cookie") ?? "";

		const headers: HeadersInit = { cookie };

		const [todayRes, teamRes, locRes, oppRes, partnerRes] = await Promise.allSettled([
			fetch(`${base}/api/dashboard/today`, { headers }),
			fetch(`${base}/api/team/performance?timeframe=week`, { headers }),
			fetch(`${base}/api/team/locations`, { headers }),
			fetch(`${base}/api/opportunities?timeframe=7d`, { headers }),
			fetch(`${base}/api/partner-engine/dashboard`, { headers }),
		]);

		const data: MissionControlData = {
			kpi: {
				housesToHit: 0,
				activeMissions: 0,
				repsInField: 0,
				exportsToday: 0,
			},
			team: {
				totalDoors: 0,
				totalAppointments: 0,
				totalLeads: 0,
				totalClosed: 0,
				totalRevenue: 0,
				members: [],
				topPerformer: "",
			},
			exportQueue: {
				readyCount: 0,
				exportedTodayCount: 0,
				failedCount: 0,
				successRatePercent: 100,
			},
		};

		if (todayRes.status === "fulfilled" && todayRes.value.ok) {
			const json = (await todayRes.value.json()) as {
				data?: {
					kpi?: { housesToHitCount?: number; activeMissionCount?: number; repsInFieldCount?: number; exportsTodayCount?: number };
					exportQueueSummary?: {
						readyCount?: number;
						exportedTodayCount?: number;
						failedCount?: number;
						successRatePercent?: number;
					};
				};
			};
			const payload = json.data ?? json;
			const kpi = payload.kpi;
			const eq = payload.exportQueueSummary;
			if (kpi) {
				data.kpi = {
					housesToHit: kpi.housesToHitCount ?? 0,
					activeMissions: kpi.activeMissionCount ?? 0,
					repsInField: kpi.repsInFieldCount ?? 0,
					exportsToday: kpi.exportsTodayCount ?? 0,
				};
			}
			if (eq) {
				data.exportQueue = {
					readyCount: eq.readyCount ?? 0,
					exportedTodayCount: eq.exportedTodayCount ?? 0,
					failedCount: eq.failedCount ?? 0,
					successRatePercent: eq.successRatePercent ?? 100,
				};
			}
		}

		if (teamRes.status === "fulfilled" && teamRes.value.ok) {
			const json = (await teamRes.value.json()) as {
				members?: Array<{
					id?: string;
					name?: string;
					stats?: { revenue?: number; doorsKnocked?: number };
				}>;
				stats?: {
					totalDoors?: number;
					totalAppointments?: number;
					totalLeads?: number;
					totalClosed?: number;
					totalRevenue?: number;
					topPerformer?: string;
				};
			};
			const stats = json.stats;
			const members = json.members ?? [];
			if (stats) {
				data.team = {
					totalDoors: stats.totalDoors ?? 0,
					totalAppointments: stats.totalAppointments ?? 0,
					totalLeads: stats.totalLeads ?? 0,
					totalClosed: stats.totalClosed ?? 0,
					totalRevenue: stats.totalRevenue ?? 0,
					members: members.slice(0, 5).map((m) => ({
						id: m.id ?? "",
						name: m.name ?? "Unknown",
						revenue: m.stats?.revenue ?? 0,
						doorsKnocked: m.stats?.doorsKnocked ?? 0,
					})),
					topPerformer: stats.topPerformer ?? "",
				};
			}
		}

		if (locRes.status === "fulfilled" && locRes.value.ok) {
			const json = (await locRes.value.json()) as { members?: Array<{ is_active?: boolean }> };
			const activeCount = (json.members ?? []).filter((m) => m.is_active).length;
			if (activeCount > 0 && data.kpi.repsInField === 0) {
				data.kpi.repsInField = activeCount;
			}
		}

		if (oppRes.status === "fulfilled" && oppRes.value.ok) {
			const json = (await oppRes.value.json()) as {
				stats?: { totalOpportunityValue?: number; activeStorms?: number; hotLeads?: number };
				storms?: Array<{ id?: string; location?: string; opportunityScore?: number }>;
			};
			const stats = json.stats;
			const storms = json.storms ?? [];
			if (stats) {
				data.opportunities = {
					totalValue: stats.totalOpportunityValue ?? 0,
					activeZones: stats.activeStorms ?? 0,
					hotLeads: stats.hotLeads ?? 0,
					stormZones: storms.slice(0, 5).map((s) => ({
						id: s.id ?? "",
						location: s.location ?? "Unknown",
						opportunityScore: s.opportunityScore ?? 0,
					})),
				};
			}
		}

		if (partnerRes.status === "fulfilled" && partnerRes.value.ok) {
			const json = (await partnerRes.value.json()) as {
				data?: {
					partnersCount?: number;
					referralsCount?: number;
					closedCount?: number;
					totalRevenue?: number;
				};
			};
			const payload = json.data ?? json;
			if (payload.partnersCount !== undefined || payload.referralsCount !== undefined) {
				data.referralEngine = {
					partnersCount: payload.partnersCount ?? 0,
					referralsCount: payload.referralsCount ?? 0,
					closedCount: payload.closedCount ?? 0,
					totalRevenue: payload.totalRevenue ?? 0,
				};
			}
		}

		log.info("mission_control.live.success", {
			userId: user.id,
			latencyMs: Date.now() - startedAt,
		});

		return successResponse(data, { latencyMs: Date.now() - startedAt });
	} catch (error) {
		log.error("mission_control.live.error", {
			message: error instanceof Error ? error.message : String(error),
			latencyMs: Date.now() - startedAt,
		});
		return errorResponse("Internal server error", 500);
	}
}
