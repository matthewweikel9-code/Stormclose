/**
 * Resolve JobNimbus API credentials for the current user.
 * 1) Row where user_id matches (personal connection)
 * 2) Team integration for user's primary team (team_id on row, or team owner's key)
 */
import { resolvePrimaryTeamId } from "@/lib/server/tenant";
import { getJobNimbusIntegrationForTeam } from "@/lib/jobnimbus/team-integration";

export async function resolveJobNimbusCredentials(
	supabase: { from: (t: string) => any },
	userId: string
): Promise<{ api_key_encrypted: string } | null> {
	const { data: own } = await (supabase as any)
		.from("jobnimbus_integrations")
		.select("api_key_encrypted")
		.eq("user_id", userId)
		.maybeSingle();

	if (own?.api_key_encrypted) {
		return { api_key_encrypted: own.api_key_encrypted };
	}

	const teamId = await resolvePrimaryTeamId(supabase, userId);
	if (!teamId) return null;

	return getJobNimbusIntegrationForTeam(supabase, teamId);
}

/**
 * Full integration row for status UI: personal row, else team row, else team owner's row.
 */
export async function resolveJobNimbusIntegrationRow(
	supabase: { from: (t: string) => any },
	userId: string
): Promise<Record<string, unknown> | null> {
	const { data: own } = await (supabase as any)
		.from("jobnimbus_integrations")
		.select("*")
		.eq("user_id", userId)
		.maybeSingle();

	if (own) return own as Record<string, unknown>;

	const teamId = await resolvePrimaryTeamId(supabase, userId);
	if (!teamId) return null;

	const { data: teamIntegration } = await (supabase as any)
		.from("jobnimbus_integrations")
		.select("*")
		.eq("team_id", teamId)
		.maybeSingle();

	if (teamIntegration) return teamIntegration as Record<string, unknown>;

	const { data: team } = await (supabase as any)
		.from("teams")
		.select("owner_id")
		.eq("id", teamId)
		.maybeSingle();

	if (!team?.owner_id) return null;

	const { data: ownerIntegration } = await (supabase as any)
		.from("jobnimbus_integrations")
		.select("*")
		.eq("user_id", team.owner_id)
		.maybeSingle();

	return (ownerIntegration as Record<string, unknown>) ?? null;
}
