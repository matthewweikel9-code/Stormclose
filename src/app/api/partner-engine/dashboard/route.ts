import { errorResponse, successResponse } from "@/utils/api-response";
import { requirePartnerEngineAuth } from "@/lib/partner-engine/auth";

export async function GET() {
	try {
		const result = await requirePartnerEngineAuth();
		if (!result.ok) return errorResponse(result.error, result.status);

		const { supabase, teamId } = result.auth;

		const [partnersRes, referralsRes, rewardsRes] = await Promise.all([
			(supabase as any)
				.from("partner_engine_partners")
				.select("id", { count: "exact", head: true })
				.eq("team_id", teamId),
			(supabase as any)
				.from("partner_engine_referrals")
				.select("id,status,partner_id,contract_value,created_at,updated_at")
				.eq("team_id", teamId),
			(supabase as any)
				.from("partner_engine_rewards")
				.select("id,amount,status")
				.eq("team_id", teamId),
		]);

		if (partnersRes.error) return errorResponse(partnersRes.error.message, 500);
		if (referralsRes.error) return errorResponse(referralsRes.error.message, 500);
		if (rewardsRes.error) return errorResponse(rewardsRes.error.message, 500);

		const referrals = (referralsRes.data ?? []) as Array<Record<string, unknown>>;
		const rewards = (rewardsRes.data ?? []) as Array<Record<string, unknown>>;

		const partnersCount = partnersRes.count ?? 0;
		const referralsCount = referrals.length;
		const installedCount = referrals.filter((r) => String(r.status ?? "") === "roof_installed").length;
		const closedCount = referrals.filter((r) => String(r.status ?? "") === "closed").length;
		const lostCount = referrals.filter((r) => String(r.status ?? "") === "lost").length;

		const totalRevenue = referrals.reduce((sum, r) => sum + Number(r.contract_value ?? 0), 0);
		const totalRewardsPaid = rewards
			.filter((r) => String(r.status ?? "") === "paid")
			.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

		const closedOrInstalledRevenue = referrals
			.filter((r) => ["roof_installed", "closed"].includes(String(r.status ?? "")))
			.reduce((sum, r) => sum + Number(r.contract_value ?? 0), 0);
		const closedOrInstalledCount = installedCount + closedCount;
		const averageContractValue =
			closedOrInstalledCount > 0 ? closedOrInstalledRevenue / closedOrInstalledCount : 0;

		const conversionRate = referralsCount > 0 ? (installedCount / referralsCount) * 100 : 0;

		const roofInstalledReferrals = referrals.filter((r) => String(r.status ?? "") === "roof_installed");
		const referralVelocity =
			roofInstalledReferrals.length > 0
				? roofInstalledReferrals.reduce((sum, r) => {
						const created = new Date((r.created_at as string) ?? 0).getTime();
						const updated = new Date((r.updated_at as string) ?? 0).getTime();
						return sum + (updated - created) / (1000 * 60 * 60 * 24);
					}, 0) / roofInstalledReferrals.length
				: 0;

		const statusCounts = new Map<string, number>();
		for (const r of referrals) {
			const s = String(r.status ?? "received");
			statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
		}
		const pipelineByStatus = [...statusCounts.entries()].map(([status, count]) => ({ status, count }));

		const byPartner = new Map<
			string,
			{ referrals: number; installed: number; revenue: number; rewardsPaid: number }
		>();
		for (const referral of referrals) {
			const partnerId = String(referral.partner_id ?? "");
			if (!partnerId) continue;
			const record = byPartner.get(partnerId) ?? {
				referrals: 0,
				installed: 0,
				revenue: 0,
				rewardsPaid: 0,
			};
			record.referrals += 1;
			if (String(referral.status ?? "") === "roof_installed") record.installed += 1;
			record.revenue += Number(referral.contract_value ?? 0);
			byPartner.set(partnerId, record);
		}

		for (const r of rewards) {
			if (String(r.status ?? "") !== "paid") continue;
			const partnerId = String(r.partner_id ?? "");
			if (!partnerId) continue;
			const record = byPartner.get(partnerId);
			if (record) record.rewardsPaid += Number(r.amount ?? 0);
		}

		const partnerIds = [...byPartner.keys()];
		let partnerMap = new Map<
			string,
			{ name: string; type: string; tier: string }
		>();
		if (partnerIds.length) {
			const { data: partnerRows } = await (supabase as any)
				.from("partner_engine_partners")
				.select("id,name,partner_type,tier")
				.in("id", partnerIds)
				.eq("team_id", teamId);
			partnerMap = new Map(
				(partnerRows ?? []).map((row: Record<string, unknown>) => [
					String(row.id),
					{
						name: String(row.name ?? ""),
						type: String(row.partner_type ?? "other"),
						tier: String(row.tier ?? "bronze"),
					},
				])
			);
		}

		const topPartners = [...byPartner.entries()]
			.map(([partnerId, stats]) => {
				const info = partnerMap.get(partnerId) ?? { name: "Unknown Partner", type: "other", tier: "bronze" };
				return {
					partnerId,
					name: info.name,
					type: info.type,
					tier: info.tier,
					referrals: stats.referrals,
					installed: stats.installed,
					revenue: stats.revenue,
					rewardsPaid: stats.rewardsPaid,
				};
			})
			.sort((a, b) => b.revenue - a.revenue)
			.slice(0, 10);

		const { data: recentReferralsRaw } = await (supabase as any)
			.from("partner_engine_referrals")
			.select("id,property_address,status,contract_value,created_at,partner_id,partner_engine_partners(name)")
			.eq("team_id", teamId)
			.order("created_at", { ascending: false })
			.limit(10);

		const recentReferrals = (recentReferralsRaw ?? []).map((row: Record<string, unknown>) => {
			const partner = row.partner_engine_partners as Record<string, unknown> | null;
			const partnerName = partner && typeof partner === "object" ? (partner.name as string) : null;
			return {
				id: String(row.id ?? ""),
				partnerName,
				propertyAddress: String(row.property_address ?? ""),
				status: String(row.status ?? "received"),
				createdAt: (row.created_at as string | null) ?? null,
				contractValue: Number(row.contract_value ?? 0),
			};
		});

		return successResponse({
			partnersCount,
			referralsCount,
			installedCount,
			closedCount,
			lostCount,
			totalRevenue,
			totalRewardsPaid,
			averageContractValue,
			conversionRate,
			referralVelocity,
			pipelineByStatus,
			topPartners,
			recentReferrals,
		});
	} catch (error) {
		return errorResponse(error instanceof Error ? error.message : "Failed to load dashboard", 500);
	}
}
