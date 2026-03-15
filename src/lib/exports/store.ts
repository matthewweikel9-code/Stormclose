import type { ExportStatus, OpportunityExportRecord } from "@/types/exports";

const nowIso = () => new Date().toISOString();

const records: OpportunityExportRecord[] = [];

function ensureSeeded() {
	if (records.length > 0) return;
	records.push({
		id: "11111111-1111-4111-8111-111111111111",
		status: "ready",
		attempts: 0,
		error: null,
		nextRetryAt: null,
		exportedAt: null,
		updatedAt: nowIso(),
		createdAt: nowIso(),
		houseId: "house-1",
		missionId: "mission-1",
		payload: {
			contact: {
				display_name: "Sample Homeowner",
				address_line1: "123 Demo Ave",
				city: "Austin",
				state_text: "TX",
				zip: "78701",
				mobile_phone: "555-0100",
				email: "demo@example.com",
			},
			notes: "Seed export record",
		},
	});
}

export function getExportById(id: string): OpportunityExportRecord | null {
	ensureSeeded();
	return records.find((record) => record.id === id) ?? null;
}

export function getReadyExports(): OpportunityExportRecord[] {
	ensureSeeded();
	return records.filter((record) => record.status === "ready");
}

export function updateExportStatus(
	id: string,
	status: ExportStatus,
	patch: Partial<
		Pick<OpportunityExportRecord, "error" | "nextRetryAt" | "exportedAt" | "attempts" | "jobnimbusId">
	>
) {
	ensureSeeded();
	const record = records.find((row) => row.id === id);
	if (!record) return;
	record.status = status;
	record.updatedAt = nowIso();
	if (patch.error !== undefined) record.error = patch.error;
	if (patch.nextRetryAt !== undefined) record.nextRetryAt = patch.nextRetryAt;
	if (patch.exportedAt !== undefined) record.exportedAt = patch.exportedAt;
	if (patch.attempts !== undefined) record.attempts = patch.attempts;
	if (patch.jobnimbusId !== undefined) record.jobnimbusId = patch.jobnimbusId;
}

export function listExports(options?: { limit?: number }) {
	ensureSeeded();
	const limit = options?.limit ?? records.length;
	const exports = [...records]
		.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
		.slice(0, limit);

	const today = new Date().toISOString().slice(0, 10);
	const readyCount = records.filter((record) => record.status === "ready").length;
	const exportedTodayCount = records.filter(
		(record) => record.status === "exported" && String(record.exportedAt ?? "").startsWith(today)
	).length;
	const failedCount = records.filter(
		(record) => record.status === "failed" || record.status === "permanently_failed"
	).length;
	const retryingCount = records.filter((record) => record.status === "retrying").length;

	return {
		exports,
		readyCount,
		exportedTodayCount,
		failedCount,
		retryingCount,
	};
}
