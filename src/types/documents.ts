export type DocumentType =
	| "homeowner_follow_up_letter"
	| "neighborhood_flyer"
	| "storm_impact_summary"
	| "mission_recap"
	| "manager_daily_summary"
	| "office_summary"
	| "qualified_opportunity_handoff"
	| "claim_explanation_letter"
	| "leave_behind"
	| "rep_field_recap";

export type DocumentFormat = "pdf" | "docx" | "clipboard" | "print";

export type DocumentContextType =
	| "storm_zone"
	| "house"
	| "mission"
	| "opportunity"
	| "team"
	| "company";

export type DocumentStatus = "draft" | "final" | "exported";

export interface DocumentRecord {
	id: string;
	type: DocumentType;
	title: string;
	contextType: DocumentContextType;
	contextId: string;
	content: string;
	format: DocumentFormat;
	createdBy: string;
	exported: boolean;
	status: DocumentStatus;
	createdAt: string;
	updatedAt: string;
	exportedAt: string | null;
	fileUrl: string | null;
}

export interface GenerateDocumentRequest {
	type: DocumentType;
	contextType: DocumentContextType;
	contextId: string;
	format?: DocumentFormat;
	title?: string;
	overrides?: Record<string, string>;
}

export interface UpdateDocumentRequest {
	title?: string;
	content?: string;
	status?: Extract<DocumentStatus, "draft" | "final">;
}

export interface ExportDocumentRequest {
	format: DocumentFormat;
}

export interface DocumentFilters {
	type?: DocumentType;
	contextType?: DocumentContextType;
	contextId?: string;
	exported?: boolean;
	q?: string;
	limit?: number;
}

export interface DocumentTypeConfig {
	type: DocumentType;
	label: string;
	defaultTitle: string;
	defaultFormat: DocumentFormat;
	maxWords: number;
}
