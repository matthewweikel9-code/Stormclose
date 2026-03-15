export type ExportStatus =
	| "ready"
	| "exporting"
	| "exported"
	| "failed"
	| "retrying"
	| "permanently_failed";

export type JobNimbusPayload = {
	contact: {
		display_name: string;
		address_line1: string;
		city: string;
		state_text: string;
		zip: string;
		mobile_phone?: string | null;
		email?: string | null;
	};
	notes?: string;
	[key: string]: unknown;
};

export type OpportunityExportRecord = {
	id: string;
	status: ExportStatus;
	attempts: number;
	error: string | null;
	nextRetryAt: string | null;
	exportedAt: string | null;
	updatedAt: string;
	createdAt: string;
	houseId?: string | null;
	missionId?: string | null;
	jobnimbusId?: string | null;
	payload: JobNimbusPayload;
};

export type TriggerExportRequest = {
	exportId?: string;
	exportIds?: string[];
	all?: boolean;
};

export type ExportPreview = {
	exportId: string;
	payload: JobNimbusPayload;
	handoffSummary: string;
	validationWarnings: string[];
};
