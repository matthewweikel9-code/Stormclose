/**
 * Append to audit log (Phase 5)
 * Call from backend with createAdminClient
 */

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function auditLog(params: {
	userId: string;
	teamId?: string | null;
	action: string;
	resourceType?: string;
	resourceId?: string;
	metadata?: Record<string, unknown>;
}): Promise<void> {
	try {
		await supabaseAdmin.from("audit_log").insert({
			user_id: params.userId,
			team_id: params.teamId ?? null,
			action: params.action,
			resource_type: params.resourceType ?? null,
			resource_id: params.resourceId ?? null,
			metadata: params.metadata ?? {},
		});
	} catch {
		// Non-blocking
	}
}
