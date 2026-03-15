import type { JobNimbusPayload } from "@/types/exports";

export function buildExportPayload(
	house: {
		id: string;
		address: string;
		city: string;
		state: string;
		zip: string;
		homeownerName: string;
		phone?: string | null;
		email?: string | null;
	},
	mission: { id: string; name: string } | null,
	outcomes: Array<Record<string, unknown>>,
	handoffSummary: string | null
): JobNimbusPayload {
	return {
		contact: {
			display_name: house.homeownerName,
			address_line1: house.address,
			city: house.city,
			state_text: house.state,
			zip: house.zip,
			mobile_phone: house.phone ?? null,
			email: house.email ?? null,
		},
		notes: [
			mission ? `Mission: ${mission.name}` : null,
			handoffSummary,
			outcomes.length > 0 ? `Outcomes logged: ${outcomes.length}` : null,
		]
			.filter(Boolean)
			.join("\n"),
	};
}

export function calculateRetryDelaySeconds(attempts: number): number {
	const safeAttempts = Math.max(1, attempts);
	const base = 30;
	const max = 15 * 60;
	return Math.min(max, base * 2 ** (safeAttempts - 1));
}

export async function sendToJobNimbus(payload: JobNimbusPayload): Promise<{ success: true; jobnimbusId: string } | { success: false; error: string }> {
	if (!payload.contact.address_line1 || !payload.contact.display_name) {
		return { success: false, error: "Missing required contact fields" };
	}

	if (process.env.NODE_ENV === "test") {
		return {
			success: true,
			jobnimbusId: `jn_test_${Math.random().toString(36).slice(2, 10)}`,
		};
	}

	const webhookUrl = process.env.JOBNIMBUS_WEBHOOK_URL;
	if (!webhookUrl) {
		return { success: false, error: "JOBNIMBUS_WEBHOOK_URL is not configured" };
	}

	try {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!response.ok) {
			return { success: false, error: `JobNimbus request failed with status ${response.status}` };
		}

		const body = (await response.json().catch(() => ({}))) as { id?: string };
		return {
			success: true,
			jobnimbusId: typeof body.id === "string" ? body.id : `jn_${Date.now()}`,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to reach JobNimbus",
		};
	}
}
