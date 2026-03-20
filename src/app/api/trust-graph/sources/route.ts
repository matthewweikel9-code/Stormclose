import { errorResponse, successResponse } from "@/utils/api-response";
import { requirePartnerEngineAuth } from "@/lib/partner-engine/auth";

export interface SourceIntelligence {
	partnerId: string;
	name: string;
	type: string;
	tier: string;
	referralsSent: number;
	closeRate: number;
	avgJobValue: number;
	revenue: number;
	lastActivityAt: string | null;
	healthScore: number;
}

export async function GET() {
	try {
		const result = await requirePartnerEngineAuth();
		if (!result.ok) return errorResponse(result.error, result.status);

		const { supabase, teamId } = result.auth;

		const { data: referrals, error: refError } = await (supabase as any)
			.from("partner_engine_referrals")
			.select("id,partner_id,status,contract_value,created_at,updated_at")
			.eq("team_id", teamId);

		if (refError) return errorResponse(refError.message, 500);

		const refs = (referrals ?? []) as Array<Record<string, unknown>>;
		const byPartner = new Map<
			string,
			{
				referrals: number;
				closed: number;
				revenue: number;
				lastActivity: string | null;
			}
		>();

		for (const r of refs) {
			const partnerId = String(r.partner_id ?? "");
			const status = String(r.status ?? "");
			const closed = ["roof_installed", "closed"].includes(status);
			const revenue = Number(r.contract_value ?? 0);
			const updated = (r.updated_at as string) ?? (r.created_at as string) ?? null;

			if (!partnerId) continue;

			const rec = byPartner.get(partnerId) ?? {
				referrals: 0,
				closed: 0,
				revenue: 0,
				lastActivity: null,
			};
			rec.referrals += 1;
			if (closed) rec.closed += 1;
			rec.revenue += revenue;
			if (updated && (!rec.lastActivity || updated > rec.lastActivity)) {
				rec.lastActivity = updated;
			}
			byPartner.set(partnerId, rec);
		}

		const partnerIds = [...byPartner.keys()];
		let partnerMap = new Map<string, { name: string; type: string; tier: string }>();
		if (partnerIds.length) {
			const { data: rows } = await (supabase as any)
				.from("partner_engine_partners")
				.select("id,name,partner_type,tier")
				.in("id", partnerIds)
				.eq("team_id", teamId);
			partnerMap = new Map(
				(rows ?? []).map((row: Record<string, unknown>) => [
					String(row.id),
					{
						name: String(row.name ?? "Unknown"),
						type: String(row.partner_type ?? "other"),
						tier: String(row.tier ?? "bronze"),
					},
				])
			);
		}

		const sources: SourceIntelligence[] = [...byPartner.entries()]
			.map(([partnerId, stats]) => {
				const info = partnerMap.get(partnerId) ?? { name: "Unknown", type: "other", tier: "bronze" };
				const closeRate = stats.referrals > 0 ? (stats.closed / stats.referrals) * 100 : 0;
				const avgJobValue = stats.closed > 0 ? stats.revenue / stats.closed : 0;

				const daysSinceActivity = stats.lastActivity
					? (Date.now() - new Date(stats.lastActivity).getTime()) / (1000 * 60 * 60 * 24)
					: 999;
				const activityScore = daysSinceActivity <= 7 ? 100 : daysSinceActivity <= 30 ? 70 : daysSinceActivity <= 90 ? 40 : 30;
				const conversionScore = Math.min(100, closeRate * 2);
				const revenueScore = Math.min(100, Math.round(stats.revenue / 500));
				const healthScore = Math.round((activityScore * 0.4 + conversionScore * 0.3 + revenueScore * 0.3));

				return {
					partnerId,
					name: info.name,
					type: info.type,
					tier: info.tier,
					referralsSent: stats.referrals,
					closeRate,
					avgJobValue,
					revenue: stats.revenue,
					lastActivityAt: stats.lastActivity,
					healthScore: Math.min(100, Math.max(0, healthScore)),
				};
			})
			.sort((a, b) => b.revenue - a.revenue);

		return successResponse({ sources });
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Failed to load source intelligence", 500);
	}
}
