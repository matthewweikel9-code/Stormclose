/**
 * Emit outbound webhook events (Phase 4)
 * Call after storm threshold, lead rescored, supplement ready, JN export
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type WebhookEvent =
	| "storm_threshold"
	| "lead_rescored"
	| "supplement_ready"
	| "jn_export_success"
	| "jn_export_failure";

export interface WebhookPayload {
	event: WebhookEvent;
	timestamp: string;
	teamId: string;
	data: Record<string, unknown>;
}

function signPayload(payload: string, secret: string): string {
	return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function emitWebhook(
	teamId: string,
	event: WebhookEvent,
	data: Record<string, unknown>
): Promise<void> {
	const { data: endpoints } = await supabaseAdmin
		.from("webhook_endpoints")
		.select("id, url, secret, events")
		.eq("team_id", teamId)
		.eq("is_active", true);

	if (!endpoints?.length) return;

	const payload: WebhookPayload = {
		event,
		timestamp: new Date().toISOString(),
		teamId,
		data,
	};

	const payloadStr = JSON.stringify(payload);

	for (const ep of endpoints) {
		const events = ep.events as string[] | null;
		if (events && !events.includes(event)) continue;

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"X-StormClose-Event": event,
			"X-StormClose-Timestamp": payload.timestamp,
		};

		if (ep.secret) {
			headers["X-StormClose-Signature"] = `sha256=${signPayload(payloadStr, ep.secret)}`;
		}

		try {
			const res = await fetch(ep.url, {
				method: "POST",
				headers,
				body: payloadStr,
			});

			await supabaseAdmin.from("webhook_deliveries").insert({
				endpoint_id: ep.id,
				event_type: event,
				payload_snapshot: data,
				status: res.ok ? "delivered" : "failed",
				status_code: res.status,
				error_message: res.ok ? null : await res.text(),
			});
		} catch (err) {
			await supabaseAdmin.from("webhook_deliveries").insert({
				endpoint_id: ep.id,
				event_type: event,
				payload_snapshot: data,
				status: "failed",
				error_message: err instanceof Error ? err.message : String(err),
			});
		}
	}
}
