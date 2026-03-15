export type ExportStatus =
	| "ready"
	| "exporting"
	| "exported"
	| "failed"
	| "retrying"
	| "permanently_failed";

export interface JobNimbusPayload {
	contact: {
		first_name: string;
		last_name: string;
		display_name: string;
		address_line1: string;
		city: string;
		state_text: string;
		zip: string;
		mobile_phone: string | null;
		email: string | null;
		source_name: "Stormclose AI";
		tags: string[];
		notes: string;
	};
	job: {
		name: string;
		description: string;
		status_name: string;
		address_line1: string;
		city: string;
		state_text: string;
		zip: string;
		tags: string[];
	};
	activity: {
		type: "note";
		title: string;
		note: string;
	};
	handoffSummary: string;
}

export interface OpportunityExportRecord {
	id: string;
	houseId: string;
	missionId: string | null;
	missionStopId: string | null;
	status: ExportStatus;
	payload: JobNimbusPayload;
	jobnimbusId: string | null;
	error: string | null;
	attempts: number;
	nextRetryAt: string | null;
	exportedAt: string | null;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

export interface ExportFilters {
	status?: ExportStatus | ExportStatus[];
	q?: string;
	limit?: number;
	offset?: number;
}

export interface TriggerExportRequest {
	exportId?: string;
	exportIds?: string[];
	all?: boolean;
}

export interface RetryExportRequest {
	resetAttempts?: boolean;
}

export interface ExportPreview {
	exportId: string;
	payload: JobNimbusPayload;
	handoffSummary: string;
	validationWarnings: string[];
}

export interface ExportListResponseData {
	exports: OpportunityExportRecord[];
	total: number;
	readyCount: number;
	exportedTodayCount: number;
	failedCount: number;
	retryingCount: number;
}
