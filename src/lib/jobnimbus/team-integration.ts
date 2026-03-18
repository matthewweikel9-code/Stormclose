/**
 * Get JobNimbus integration for a team.
 * 1. Team-level integration (team_id set)
 * 2. Fallback: team owner's user-level integration
 */
export async function getJobNimbusIntegrationForTeam(
	supabase: any,
	teamId: string
): Promise<{ api_key_encrypted: string } | null> {
	// 1. Team-level integration
	const { data: teamIntegration } = await (supabase as any)
		.from("jobnimbus_integrations")
		.select("api_key_encrypted")
		.eq("team_id", teamId)
		.maybeSingle();

	if (teamIntegration?.api_key_encrypted) return teamIntegration;

	// 2. Fallback: team owner's integration
	const { data: team } = await (supabase as any)
		.from("teams")
		.select("owner_id")
		.eq("id", teamId)
		.maybeSingle();

	if (!team?.owner_id) return null;

	const { data: ownerIntegration } = await (supabase as any)
		.from("jobnimbus_integrations")
		.select("api_key_encrypted")
		.eq("user_id", team.owner_id)
		.maybeSingle();

	return ownerIntegration?.api_key_encrypted ? { api_key_encrypted: ownerIntegration.api_key_encrypted } : null;
}
