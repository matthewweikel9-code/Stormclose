import { createJobNimbusClient } from "@/lib/jobnimbus";
import {
	createExport,
	getExportById,
	updateExportStatus,
} from "@/lib/exports/store";
import type {
	JobNimbusPayload,
	OpportunityExportRecord,
} from "@/types/exports";

const MAX_RETRIES = 3;
const RETRY_BASE_SECONDS = 60;

function splitDisplayName(displayName: string) {
	const parts = displayName.trim().split(/\s+/);
	if (parts.length <= 1) {
		return { firstName: parts[0] || "Homeowner", lastName: "" };
	}
	return {
		firstName: parts.slice(0, -1).join(" "),
		lastName: parts.slice(-1).join(""),
	};
}

export function calculateRetryDelaySeconds(nextAttempt: number) {
	const cappedAttempt = Math.max(1, Math.min(nextAttempt, MAX_RETRIES));
	const jitter = 15;
	return RETRY_BASE_SECONDS * 2 ** (cappedAttempt - 1) + jitter;
}

export function buildExportPayload(
	house: {
		id: string;
		address: string;
		city: string;
		state: string;
		zip: string;
		homeownerName?: string | null;
		phone?: string | null;
		email?: string | null;
		stormZoneName?: string | null;
		estimatedValueBand?: string | null;
		opportunityScore?: number | null;
	},
	mission: { id: string; name: string } | null,
	stops: Array<{ outcome?: string; notes?: string | null }> = [],
	notes: string | null = null,
): JobNimbusPayload {
	const displayName = house.homeownerName?.trim() || `Homeowner at ${house.address}`;
	const { firstName, lastName } = splitDisplayName(displayName);
	const outcome = stops.find((stop) => stop.outcome)?.outcome ?? "interested";
	const stopNotes = stops
		.map((stop) => stop.notes)
		.filter((value): value is string => Boolean(value && value.trim()))
		.join("\n");
	const sourceNotes = [
		"--- Imported from Stormclose AI ---",
		`Property: ${house.address}, ${house.city}, ${house.state} ${house.zip}`,
		house.stormZoneName ? `Storm Zone: ${house.stormZoneName}` : null,
		house.estimatedValueBand ? `Estimated Value: ${house.estimatedValueBand}` : null,
		typeof house.opportunityScore === "number" ? `Opportunity Score: ${house.opportunityScore}/100` : null,
		`Outcome: ${outcome}`,
		mission ? `Mission: ${mission.name}` : null,
		stopNotes || null,
		notes || null,
	].filter(Boolean);

	const handoffSummary = `${displayName} at ${house.address} is qualified and ready for JobNimbus handoff.`;

	return {
		contact: {
			first_name: firstName || "Homeowner",
			last_name: lastName,
			display_name: displayName,
			address_line1: house.address,
			city: house.city,
			state_text: house.state,
			zip: house.zip,
			mobile_phone: house.phone ?? null,
			email: house.email ?? null,
			source_name: "Stormclose AI",
			tags: ["Stormclose", "AI Lead", mission?.name ?? "No Mission"],
			notes: sourceNotes.join("\n"),
		},
		job: {
			name: `${house.address} - Storm Opportunity`,
			description: handoffSummary,
			status_name: "Lead",
			address_line1: house.address,
			city: house.city,
			state_text: house.state,
			zip: house.zip,
			tags: ["Stormclose", "Storm Opportunity"],
		},
		activity: {
			type: "note",
			title: "Stormclose Export Handoff",
			note: handoffSummary,
		},
		handoffSummary,
	};
}

export async function sendToJobNimbus(payload: JobNimbusPayload): Promise<{
	success: boolean;
	jobnimbusId: string | null;
	error: string | null;
}> {
	if (process.env.NODE_ENV === "test") {
		return {
			success: true,
			jobnimbusId: `jn_test_${Date.now()}`,
			error: null,
		};
	}

	const apiKey = process.env.JOBNIMBUS_API_KEY;
	if (!apiKey) {
		return {
			success: false,
			jobnimbusId: null,
			error: "JobNimbus API key is not configured",
		};
	}

	const client = createJobNimbusClient(apiKey);
	const contactResult = await client.createContact(payload.contact);
	if (!contactResult.success || !contactResult.data?.id) {
		return {
			success: false,
			jobnimbusId: null,
			error: contactResult.error?.detail ?? "Failed to create JobNimbus contact",
		};
	}

	const contactId = contactResult.data.id;
	const jobResult = await client.createJob({
		contact_id: contactId,
		name: payload.job.name,
		description: payload.job.description,
		status_name: payload.job.status_name,
		address_line1: payload.job.address_line1,
		city: payload.job.city,
		state_text: payload.job.state_text,
		zip: payload.job.zip,
		tags: payload.job.tags,
	});

	if (!jobResult.success) {
		return {
			success: false,
			jobnimbusId: contactId,
			error: jobResult.error?.detail ?? "Failed to create JobNimbus job",
		};
	}

	await client.createActivity({
		contact_id: contactId,
		job_id: jobResult.data?.id,
		type: "note",
		title: payload.activity.title,
		note: payload.activity.note,
	});

	return {
		success: true,
		jobnimbusId: contactId,
		error: null,
	};
}

export async function retryExport(exportId: string): Promise<OpportunityExportRecord | null> {
	const current = getExportById(exportId);
	if (!current) return null;
	if (current.status !== "failed" && current.status !== "retrying" && current.status !== "permanently_failed") {
		return null;
	}

	const nextAttempt = current.attempts + 1;
	if (nextAttempt >= MAX_RETRIES) {
		return updateExportStatus(exportId, "permanently_failed", {
			attempts: nextAttempt,
			nextRetryAt: null,
		});
	}

	const delaySeconds = calculateRetryDelaySeconds(nextAttempt);
	const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
	return updateExportStatus(exportId, "retrying", {
		attempts: nextAttempt,
		nextRetryAt,
	});
}

export async function queueExport(input: {
	houseId: string;
	missionId: string | null;
	missionStopId: string | null;
	createdBy: string;
	payload: JobNimbusPayload;
}) {
	return createExport({
		houseId: input.houseId,
		missionId: input.missionId,
		missionStopId: input.missionStopId,
		createdBy: input.createdBy,
		payload: input.payload,
		status: "ready",
	});
}
