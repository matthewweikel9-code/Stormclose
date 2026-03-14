"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Download, FileText, Filter, Plus, Save, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
	DocumentRecord,
	DocumentType,
	DocumentContextType,
	DocumentFormat,
} from "@/types/documents";

const DOCUMENT_TYPES: Array<{ value: DocumentType; label: string }> = [
	{ value: "homeowner_follow_up_letter", label: "Homeowner Follow-Up" },
	{ value: "neighborhood_flyer", label: "Neighborhood Flyer" },
	{ value: "storm_impact_summary", label: "Storm Impact Summary" },
	{ value: "mission_recap", label: "Mission Recap" },
	{ value: "manager_daily_summary", label: "Manager Daily Summary" },
	{ value: "office_summary", label: "Office Summary" },
	{ value: "qualified_opportunity_handoff", label: "Opportunity Handoff" },
	{ value: "claim_explanation_letter", label: "Claim Explanation" },
	{ value: "leave_behind", label: "Leave-Behind" },
	{ value: "rep_field_recap", label: "Rep Field Recap" },
];

const CONTEXT_TYPES: DocumentContextType[] = [
	"house",
	"mission",
	"opportunity",
	"storm_zone",
	"team",
	"company",
];

const EXPORT_FORMATS: DocumentFormat[] = ["pdf", "docx", "clipboard", "print"];

function statusVariant(status: DocumentRecord["status"]): "warning" | "success" | "info" {
	if (status === "exported") return "success";
	if (status === "final") return "info";
	return "warning";
}

export function Phase8DocumentsPage() {
	const searchParams = useSearchParams();
	const [documents, setDocuments] = useState<DocumentRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [query, setQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [selected, setSelected] = useState<DocumentRecord | null>(null);

	const [genType, setGenType] = useState<DocumentType>("homeowner_follow_up_letter");
	const [genContextType, setGenContextType] = useState<DocumentContextType>("house");
	const [genContextId, setGenContextId] = useState("");
	const [genFormat, setGenFormat] = useState<DocumentFormat>("pdf");
	const [generating, setGenerating] = useState(false);

	const [editorTitle, setEditorTitle] = useState("");
	const [editorContent, setEditorContent] = useState("");
	const [saving, setSaving] = useState(false);
	const [exportingFormat, setExportingFormat] = useState<DocumentFormat | null>(null);

	const [showObjection, setShowObjection] = useState(false);
	const [showNegotiation, setShowNegotiation] = useState(false);
	const [objectionText, setObjectionText] = useState("");
	const [objectionOutput, setObjectionOutput] = useState("");
	const [objectionBusy, setObjectionBusy] = useState(false);
	const [negotiationScenario, setNegotiationScenario] = useState("initial_pricing");
	const [negotiationInput, setNegotiationInput] = useState("");
	const [negotiationOutput, setNegotiationOutput] = useState("");
	const [negotiationBusy, setNegotiationBusy] = useState(false);

	async function loadDocuments(filter?: { type?: string; q?: string }) {
		setLoading(true);
		const params = new URLSearchParams();
		if (filter?.type && filter.type !== "all") params.set("type", filter.type);
		if (filter?.q) params.set("q", filter.q);
		const response = await fetch(`/api/documents?${params.toString()}`);
		const payload = await response.json();
		const rows: DocumentRecord[] = Array.isArray(payload.data) ? payload.data : [];
		setDocuments(rows);
		if (!selected && rows.length > 0) {
			setSelected(rows[0]);
		}
		setLoading(false);
	}

	useEffect(() => {
		void loadDocuments({ type: typeFilter, q: query });
	}, [typeFilter, query]);

	useEffect(() => {
		if (!selected) {
			setEditorTitle("");
			setEditorContent("");
			return;
		}
		setEditorTitle(selected.title);
		setEditorContent(selected.content);
	}, [selected]);

	useEffect(() => {
		const action = searchParams.get("action");
		if (action !== "generate") return;
		const type = searchParams.get("type") as DocumentType | null;
		const contextType = searchParams.get("contextType") as DocumentContextType | null;
		const contextId = searchParams.get("contextId");
		if (type) setGenType(type);
		if (contextType) setGenContextType(contextType);
		if (contextId) setGenContextId(contextId);
	}, [searchParams]);

	const metrics = useMemo(() => {
		const draftCount = documents.filter((d) => d.status === "draft").length;
		const today = new Date().toISOString().slice(0, 10);
		const exportedToday = documents.filter((d) => d.exported && d.exportedAt?.startsWith(today)).length;
		return {
			total: documents.length,
			draftCount,
			exportedToday,
		};
	}, [documents]);

	async function handleGenerateDocument() {
		if (!genContextId.trim()) return;
		setGenerating(true);
		const response = await fetch("/api/documents/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: genType,
				contextType: genContextType,
				contextId: genContextId,
				format: genFormat,
			}),
		});
		const payload = await response.json();
		if (payload.data) {
			setSelected(payload.data);
			await loadDocuments({ type: typeFilter, q: query });
		}
		setGenerating(false);
	}

	async function handleSave() {
		if (!selected) return;
		setSaving(true);
		const response = await fetch(`/api/documents/${selected.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: editorTitle, content: editorContent }),
		});
		const payload = await response.json();
		if (payload.data) {
			setSelected(payload.data);
			await loadDocuments({ type: typeFilter, q: query });
		}
		setSaving(false);
	}

	async function handleExport(format: DocumentFormat) {
		if (!selected) return;
		setExportingFormat(format);
		const response = await fetch(`/api/documents/${selected.id}/export`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ format }),
		});
		const payload = await response.json();

		if (format === "clipboard") {
			await navigator.clipboard.writeText(editorContent);
		}

		if (payload.data?.url) {
			window.open(payload.data.url, "_blank");
		}

		await loadDocuments({ type: typeFilter, q: query });
		setExportingFormat(null);
	}

	async function runObjectionAssist() {
		if (!objectionText.trim()) return;
		setObjectionBusy(true);
		const response = await fetch("/api/ai/objection-response", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				objection: objectionText,
				category: null,
				homeownerName: null,
				projectType: "roof_replacement",
				saveAsDocument: false,
			}),
		});
		const payload = await response.json();
		setObjectionOutput(payload?.data?.response ?? payload?.error ?? "No response.");
		setObjectionBusy(false);
	}

	async function runNegotiationAssist() {
		if (!negotiationInput.trim()) return;
		setNegotiationBusy(true);
		const response = await fetch("/api/ai/negotiation-coach", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				scenario: negotiationScenario,
				situationDescription: negotiationInput,
				saveAsDocument: false,
			}),
		});
		const payload = await response.json();
		setNegotiationOutput(payload?.data?.strategy ?? payload?.error ?? "No response.");
		setNegotiationBusy(false);
	}

	return (
		<div className="space-y-5">
			<header className="rounded-2xl border border-storm-border bg-storm-z2 p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-2xl font-bold text-white">Documents</h1>
						<p className="text-sm text-storm-muted">Workflow-connected document generation, editing, and export.</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button variant="secondary" onClick={() => setShowObjection((v) => !v)}>
							<Bot className="mr-1 h-4 w-4" />
							Objection Assist
						</Button>
						<Button variant="secondary" onClick={() => setShowNegotiation((v) => !v)}>
							<ShieldCheck className="mr-1 h-4 w-4" />
							Negotiation Coach
						</Button>
					</div>
				</div>
				<div className="mt-4 flex flex-wrap gap-2">
					<Badge variant="purple">Total: {metrics.total}</Badge>
					<Badge variant="warning">Drafts: {metrics.draftCount}</Badge>
					<Badge variant="success">Exported Today: {metrics.exportedToday}</Badge>
				</div>
			</header>

			{showObjection ? (
				<Card>
					<CardHeader>
						<CardTitle>Objection Response Assistant</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<textarea
							value={objectionText}
							onChange={(event) => setObjectionText(event.target.value)}
							placeholder="Enter homeowner objection..."
							className="h-24 w-full rounded-xl border border-storm-border bg-storm-z1 p-3 text-sm text-white"
						/>
						<Button onClick={runObjectionAssist} disabled={objectionBusy || !objectionText.trim()}>
							<Send className="mr-1 h-4 w-4" />
							{objectionBusy ? "Generating..." : "Generate Response"}
						</Button>
						{objectionOutput ? (
							<div className="rounded-xl border border-storm-border bg-storm-z1 p-3 text-sm text-storm-muted whitespace-pre-wrap">{objectionOutput}</div>
						) : null}
					</CardContent>
				</Card>
			) : null}

			{showNegotiation ? (
				<Card>
					<CardHeader>
						<CardTitle>Negotiation Coach</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<select
							value={negotiationScenario}
							onChange={(event) => setNegotiationScenario(event.target.value)}
							className="rounded-xl border border-storm-border bg-storm-z1 px-3 py-2 text-sm text-white"
						>
							<option value="initial_pricing">Initial Pricing</option>
							<option value="competitor_comparison">Competitor Comparison</option>
							<option value="insurance_supplement">Insurance Supplement</option>
							<option value="scope_reduction">Scope Reduction</option>
							<option value="payment_terms">Payment Terms</option>
							<option value="adjuster_meeting">Adjuster Meeting</option>
							<option value="custom">Custom</option>
						</select>
						<textarea
							value={negotiationInput}
							onChange={(event) => setNegotiationInput(event.target.value)}
							placeholder="Describe the negotiation scenario..."
							className="h-24 w-full rounded-xl border border-storm-border bg-storm-z1 p-3 text-sm text-white"
						/>
						<Button onClick={runNegotiationAssist} disabled={negotiationBusy || !negotiationInput.trim()}>
							<Send className="mr-1 h-4 w-4" />
							{negotiationBusy ? "Generating..." : "Generate Coaching"}
						</Button>
						{negotiationOutput ? (
							<div className="rounded-xl border border-storm-border bg-storm-z1 p-3 text-sm text-storm-muted whitespace-pre-wrap">{negotiationOutput}</div>
						) : null}
					</CardContent>
				</Card>
			) : null}

			<div className="grid gap-5 xl:grid-cols-3">
				<Card className="xl:col-span-1">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Plus className="h-4 w-4" />
							Generate Document
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<select
							value={genType}
							onChange={(event) => setGenType(event.target.value as DocumentType)}
							className="w-full rounded-xl border border-storm-border bg-storm-z1 px-3 py-2 text-sm text-white"
						>
							{DOCUMENT_TYPES.map((type) => (
								<option key={type.value} value={type.value}>{type.label}</option>
							))}
						</select>
						<select
							value={genContextType}
							onChange={(event) => setGenContextType(event.target.value as DocumentContextType)}
							className="w-full rounded-xl border border-storm-border bg-storm-z1 px-3 py-2 text-sm text-white"
						>
							{CONTEXT_TYPES.map((type) => (
								<option key={type} value={type}>{type}</option>
							))}
						</select>
						<input
							value={genContextId}
							onChange={(event) => setGenContextId(event.target.value)}
							placeholder="Context ID (house-1, mission-3...)"
							className="w-full rounded-xl border border-storm-border bg-storm-z1 px-3 py-2 text-sm text-white"
						/>
						<select
							value={genFormat}
							onChange={(event) => setGenFormat(event.target.value as DocumentFormat)}
							className="w-full rounded-xl border border-storm-border bg-storm-z1 px-3 py-2 text-sm text-white"
						>
							{EXPORT_FORMATS.map((format) => (
								<option key={format} value={format}>{format.toUpperCase()}</option>
							))}
						</select>
						<Button onClick={handleGenerateDocument} disabled={generating || !genContextId.trim()}>
							<FileText className="mr-1 h-4 w-4" />
							{generating ? "Generating..." : "Generate"}
						</Button>
					</CardContent>
				</Card>

				<Card className="xl:col-span-2">
					<CardHeader>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<CardTitle>Document List</CardTitle>
							<div className="flex items-center gap-2">
								<Filter className="h-4 w-4 text-storm-subtle" />
								<select
									value={typeFilter}
									onChange={(event) => setTypeFilter(event.target.value)}
									className="rounded-xl border border-storm-border bg-storm-z1 px-2 py-1.5 text-xs text-white"
								>
									<option value="all">All Types</option>
									{DOCUMENT_TYPES.map((type) => (
										<option key={type.value} value={type.value}>{type.label}</option>
									))}
								</select>
								<input
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder="Search"
									className="rounded-xl border border-storm-border bg-storm-z1 px-2 py-1.5 text-xs text-white"
								/>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-2">
						{loading ? <p className="text-sm text-storm-muted">Loading documents...</p> : null}
						{!loading && documents.length === 0 ? <p className="text-sm text-storm-muted">No documents found.</p> : null}
						{documents.map((doc) => (
							<button
								key={doc.id}
								onClick={() => setSelected(doc)}
								className={`w-full rounded-lg border px-3 py-2 text-left ${selected?.id === doc.id ? "border-storm-purple bg-storm-z2" : "border-storm-border bg-storm-z1"}`}
							>
								<div className="flex items-center justify-between gap-2">
									<p className="text-sm font-semibold text-white">{doc.title}</p>
									<Badge variant={statusVariant(doc.status)}>{doc.status}</Badge>
								</div>
								<p className="text-xs text-storm-muted">{doc.type} • {new Date(doc.createdAt).toLocaleString()}</p>
							</button>
						))}
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Viewer / Editor</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{!selected ? <p className="text-sm text-storm-muted">Select a document to edit or export.</p> : null}
					{selected ? (
						<>
							<input
								value={editorTitle}
								onChange={(event) => setEditorTitle(event.target.value)}
								className="w-full rounded-xl border border-storm-border bg-storm-z1 px-3 py-2 text-white"
							/>
							<textarea
								value={editorContent}
								onChange={(event) => setEditorContent(event.target.value)}
								className="h-64 w-full rounded-xl border border-storm-border bg-storm-z1 p-3 text-sm text-white"
							/>
							<div className="flex flex-wrap items-center gap-2">
								<Button onClick={handleSave} disabled={saving}>
									<Save className="mr-1 h-4 w-4" />
									{saving ? "Saving..." : "Save"}
								</Button>
								{EXPORT_FORMATS.map((format) => (
									<Button
										key={format}
										variant="secondary"
										onClick={() => void handleExport(format)}
										disabled={exportingFormat !== null}
									>
										<Download className="mr-1 h-4 w-4" />
										{exportingFormat === format ? "Exporting..." : `Export ${format.toUpperCase()}`}
									</Button>
								))}
							</div>
						</>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
