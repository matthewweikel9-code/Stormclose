import { randomUUID } from "crypto";
import type {
	DocumentRecord,
	DocumentFilters,
	DocumentType,
	DocumentContextType,
	DocumentFormat,
	UpdateDocumentRequest,
} from "@/types/documents";

const inMemoryDocuments: DocumentRecord[] = [];

export function makeDocumentId() {
	try {
		return randomUUID();
	} catch {
		return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	}
}

export function listDocuments(filters: DocumentFilters = {}): DocumentRecord[] {
	let docs = [...inMemoryDocuments];

	if (filters.type) docs = docs.filter((d) => d.type === filters.type);
	if (filters.contextType) docs = docs.filter((d) => d.contextType === filters.contextType);
	if (filters.contextId) docs = docs.filter((d) => d.contextId === filters.contextId);
	if (typeof filters.exported === "boolean") docs = docs.filter((d) => d.exported === filters.exported);
	if (filters.q) {
		const q = filters.q.toLowerCase();
		docs = docs.filter(
			(d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q),
		);
	}

	docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	const limit = typeof filters.limit === "number" && filters.limit > 0 ? filters.limit : 50;
	return docs.slice(0, Math.min(limit, 200));
}

export function getDocumentById(id: string): DocumentRecord | null {
	return inMemoryDocuments.find((d) => d.id === id) ?? null;
}

export function createDocument(input: {
	type: DocumentType;
	title: string;
	contextType: DocumentContextType;
	contextId: string;
	content: string;
	format: DocumentFormat;
	createdBy: string;
}): DocumentRecord {
	const now = new Date().toISOString();
	const record: DocumentRecord = {
		id: makeDocumentId(),
		type: input.type,
		title: input.title,
		contextType: input.contextType,
		contextId: input.contextId,
		content: input.content,
		format: input.format,
		createdBy: input.createdBy,
		exported: false,
		status: "draft",
		createdAt: now,
		updatedAt: now,
		exportedAt: null,
		fileUrl: null,
	};
	inMemoryDocuments.unshift(record);
	return record;
}

export function updateDocument(id: string, patch: UpdateDocumentRequest): DocumentRecord | null {
	const target = getDocumentById(id);
	if (!target) return null;
	if (target.status === "exported") return null;

	if (typeof patch.title === "string") target.title = patch.title;
	if (typeof patch.content === "string") target.content = patch.content;
	if (patch.status) target.status = patch.status;
	target.updatedAt = new Date().toISOString();
	return target;
}

export function markDocumentExported(id: string, format: DocumentFormat): DocumentRecord | null {
	const target = getDocumentById(id);
	if (!target) return null;
	target.exported = true;
	target.status = "exported";
	target.format = format;
	target.exportedAt = new Date().toISOString();
	target.updatedAt = target.exportedAt;
	if (format === "pdf" || format === "docx") {
		target.fileUrl = `https://example.local/exports/${target.id}.${format}`;
	}
	return target;
}

export function resetDocumentsStore() {
	inMemoryDocuments.length = 0;
}
