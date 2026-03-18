export type TeamRole = "owner" | "admin" | "manager" | "member";

type MembershipRow = {
	team_id: string;
	role: TeamRole;
};

const DEFAULT_ROLE_ORDER: TeamRole[] = ["member", "manager", "admin", "owner"];

function roleRank(role: TeamRole) {
	return DEFAULT_ROLE_ORDER.indexOf(role);
}

export function hasMinimumRole(role: TeamRole | null, minimumRole: TeamRole): boolean {
	if (!role) return false;
	return roleRank(role) >= roleRank(minimumRole);
}

export async function getUserTeamMemberships(supabase: any, userId: string): Promise<MembershipRow[]> {
	const { data, error } = await (supabase.from("team_members") as any)
		.select("team_id, role")
		.eq("user_id", userId);

	if (error) {
		throw new Error(`Failed to load team memberships: ${error.message}`);
	}

	return (data ?? []) as MembershipRow[];
}

export async function getUserRoleForTeam(
	supabase: any,
	userId: string,
	teamId: string
): Promise<TeamRole | null> {
	const { data: membership } = await (supabase.from("team_members") as any)
		.select("role")
		.eq("team_id", teamId)
		.eq("user_id", userId)
		.maybeSingle();

	if (membership?.role) {
		return membership.role as TeamRole;
	}

	const { data: team } = await (supabase.from("teams") as any)
		.select("owner_id")
		.eq("id", teamId)
		.maybeSingle();

	if (team?.owner_id === userId) {
		return "owner";
	}

	return null;
}

export async function resolveTeamIdForUser(
	supabase: any,
	userId: string,
	requestedTeamId?: string | null
): Promise<string | null> {
	const memberships = await getUserTeamMemberships(supabase, userId);
	if (memberships.length > 0 && !requestedTeamId) {
		return memberships[0].team_id;
	}
	if (memberships.length > 0 && requestedTeamId) {
		const belongs = memberships.some((m) => m.team_id === requestedTeamId);
		if (belongs) return requestedTeamId;
	}

	const { data: ownedTeam } = await (supabase.from("teams") as any)
		.select("id")
		.eq("owner_id", userId)
		.order("created_at", { ascending: true })
		.limit(1)
		.maybeSingle();

	if (ownedTeam?.id) {
		if (!requestedTeamId || requestedTeamId === ownedTeam.id) return ownedTeam.id;
	}
	return null;
}

/** Resolve primary team for user (first membership or owned team). Used by partner engine, team members, etc. */
export async function resolvePrimaryTeamId(supabase: any, userId: string): Promise<string | null> {
	const memberships = await getUserTeamMemberships(supabase, userId);
	if (memberships.length > 0) return memberships[0].team_id;

	const { data: ownedTeam } = await (supabase.from("teams") as any)
		.select("id")
		.eq("owner_id", userId)
		.order("created_at", { ascending: true })
		.limit(1)
		.maybeSingle();

	return ownedTeam?.id ?? null;
}

export async function resolveWriteTeamIdForUser(
	supabase: any,
	userId: string,
	requestedTeamId?: string | null
): Promise<string | null> {
	let memberships = await getUserTeamMemberships(supabase, userId);
	if (memberships.length === 0) {
		const { data: ownedTeam } = await (supabase.from("teams") as any)
			.select("id")
			.eq("owner_id", userId)
			.limit(1)
			.maybeSingle();
		if (ownedTeam?.id) memberships = [{ team_id: ownedTeam.id, role: "owner" as TeamRole }];
	}
	if (memberships.length === 0) return null;

	if (!requestedTeamId) {
		if (memberships.length === 1) return memberships[0].team_id;
		throw new Error("teamId is required when writing data across multiple teams");
	}

	const belongs = memberships.some((m) => m.team_id === requestedTeamId);
	return belongs ? requestedTeamId : null;
}
