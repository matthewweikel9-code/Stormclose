import { createClient } from "@/lib/supabase/server";
import { getUserSubscription } from "@/lib/subscriptions/access";
import {
	resolvePrimaryTeamId,
	getUserRoleForTeam,
	hasMinimumRole,
	type TeamRole,
} from "@/lib/server/tenant";

export type PartnerEngineAuth = {
	supabase: Awaited<ReturnType<typeof createClient>>;
	userId: string;
	teamId: string;
	role: TeamRole | null;
};

/** Require auth, enterprise tier, and team. Returns 401/403 or auth context. */
export async function requirePartnerEngineAuth(): Promise<
	{ ok: true; auth: PartnerEngineAuth } | { ok: false; status: number; error: string }
> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { ok: false, status: 401, error: "Unauthorized" };

	const subscription = await getUserSubscription(user.id);
	const effectiveTier = subscription?.effectiveTier ?? "free";
	if (effectiveTier !== "enterprise") {
		return { ok: false, status: 403, error: "Referral Engine requires an Enterprise plan" };
	}

	const teamId = await resolvePrimaryTeamId(supabase, user.id);
	if (!teamId) {
		return { ok: false, status: 403, error: "No team found. Create or join a team to use Referral Engine." };
	}

	const role = await getUserRoleForTeam(supabase, user.id, teamId);
	return {
		ok: true,
		auth: { supabase, userId: user.id, teamId, role },
	};
}

/** Require manager role or higher (manager, admin, owner). For managing referrals, rewards, sync. */
export function requireManager(auth: PartnerEngineAuth): { ok: false; status: number; error: string } | null {
	if (!hasMinimumRole(auth.role, "manager")) {
		return { ok: false, status: 403, error: "Manager role or higher required" };
	}
	return null;
}

/** Require admin role or higher (admin, owner). For settings, partner management, bulk import. */
export function requireAdmin(auth: PartnerEngineAuth): { ok: false; status: number; error: string } | null {
	if (!hasMinimumRole(auth.role, "admin")) {
		return { ok: false, status: 403, error: "Admin role or higher required" };
	}
	return null;
}
