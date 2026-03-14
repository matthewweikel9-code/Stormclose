import { randomUUID } from "crypto";
import type {
	ExportFilters,
	ExportListResponseData,
	ExportPreview,
	ExportStatus,
	JobNimbusPayload,
	OpportunityExportRecord,
} from "@/types/exports";

const inMemoryExports: OpportunityExportRecord[] = [];

function makeExportId() {
	try {
		return randomUUID();
	} catch {
		return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	}
}

export function listExports(filters: ExportFilters = {}): ExportListResponseData {
	let rows = [...inMemoryExports];

	if (filters.status) {
		const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
		rows = rows.filter((record) => statuses.includes(record.status));
	}

	if (filters.q) {
		const q = filters.q.toLowerCase();
		rows = rows.filter((record) => {
			const address = record.payload.contact.address_line1.toLowerCase();
			const displayName = record.payload.contact.display_name.toLowerCase();
			return address.includes(q) || displayName.includes(q);
		});
	}

	rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	const offset = filters.offset && filters.offset > 0 ? filters.offset : 0;
	const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 200) : 50;
	const paged = rows.slice(offset, offset + limit);
	const today = new Date().toISOString().slice(0, 10);

	return {
		exports: paged,
		total: rows.length,
		readyCount: inMemoryExports.filter((record) => record.status === "ready").length,
		exportedTodayCount: inMemoryExports.filter(
			(record) => record.status === "exported" && record.exportedAt?.startsWith(today),
		).length,
		failedCount: inMemoryExports.filter((record) => record.status === "failed").length,
		retryingCount: inMemoryExports.filter((record) => record.status === "retrying").length,
	};
}

export function getExportById(id: string): OpportunityExportRecord | null {
	return inMemoryExports.find((record) => record.id === id) ?? null;
}

export function createExport(input: {
	houseId: string;
	missionId: string | null;
	missionStopId: string | null;
	createdBy: string;
	payload: JobNimbusPayload;
	status?: ExportStatus;
	attempts?: number;
	nextRetryAt?: string | null;
	error?: string | null;
	exportedAt?: string | null;
	jobnimbusId?: string | null;
}): OpportunityExportRecord {
	const now = new Date().toISOString();
	const record: OpportunityExportRecord = {
		id: makeExportId(),
		houseId: input.houseId,
		missionId: input.missionId,
		missionStopId: input.missionStopId,
		status: input.status ?? "ready",
		payload: input.payload,
		jobnimbusId: input.jobnimbusId ?? null,
		error: input.error ?? null,
		attempts: input.attempts ?? 0,
		nextRetryAt: input.nextRetryAt ?? null,
		exportedAt: input.exportedAt ?? null,
		createdBy: input.createdBy,
		createdAt: now,
		updatedAt: now,
	};
	inMemoryExports.unshift(record);
	return record;
}

export function updateExportStatus(id: string, status: ExportStatus, patch?: Partial<OpportunityExportRecord>) {
	const record = getExportById(id);
	if (!record) return null;
	record.status = status;
	if (patch) {
		if (typeof patch.error !== "undefined") record.error = patch.error;
		if (typeof patch.jobnimbusId !== "undefined") record.jobnimbusId = patch.jobnimbusId;
		if (typeof patch.nextRetryAt !== "undefined") record.nextRetryAt = patch.nextRetryAt;
		if (typeof patch.exportedAt !== "undefined") record.exportedAt = patch.exportedAt;
		if (typeof patch.attempts !== "undefined") record.attempts = patch.attempts;
	}
	record.updatedAt = new Date().toISOString();
	return record;
}

export function getReadyExports(): OpportunityExportRecord[] {
	return inMemoryExports.filter((record) => record.status === "ready");
}

export function toPreview(record: OpportunityExportRecord): ExportPreview {
	const warnings: string[] = [];
	if (!record.payload.contact.mobile_phone && !record.payload.contact.email) {
		warnings.push("No contact phone or email captured.");
	}
	if (record.payload.contact.display_name.toLowerCase().includes("homeowner")) {
		warnings.push("Homeowner name looks generic.");
	}

	return {
		exportId: record.id,
		payload: record.payload,
		handoffSummary: record.payload.handoffSummary,
		validationWarnings: warnings,
	};
}

export function resetExportsStore() {
	inMemoryExports.length = 0;
}
