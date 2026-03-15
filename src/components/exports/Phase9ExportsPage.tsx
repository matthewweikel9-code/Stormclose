"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, Send, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import type { ExportPreview, OpportunityExportRecord } from "@/types/exports";

type TabKey = "ready" | "exported" | "failed" | "retrying";

const TABS: Array<{ key: TabKey; label: string }> = [
	{ key: "ready", label: "Ready" },
	{ key: "exported", label: "Recently Exported" },
	{ key: "failed", label: "Failed" },
	{ key: "retrying", label: "Retry Queue" },
];

function statusBadge(status: OpportunityExportRecord["status"]) {
	if (status === "exported") return "success" as const;
	if (status === "failed" || status === "permanently_failed") return "danger" as const;
	if (status === "retrying") return "info" as const;
	return "warning" as const;
}

export function Phase9ExportsPage() {
	const [records, setRecords] = useState<OpportunityExportRecord[]>([]);
	const [activeTab, setActiveTab] = useState<TabKey>("ready");
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [preview, setPreview] = useState<ExportPreview | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function load() {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch("/api/exports?limit=200");
			const payload = await response.json();
			if (!response.ok || payload?.error) {
				throw new Error(payload?.error ?? "Failed to load exports");
			}
			setRecords(Array.isArray(payload?.data?.exports) ? payload.data.exports : []);
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Failed to load exports");
			setRecords([]);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void load();
		const interval = window.setInterval(() => {
			void load();
		}, 60_000);
		return () => window.clearInterval(interval);
	}, []);

	const filtered = useMemo(() => {
		if (activeTab === "ready") return records.filter((record) => record.status === "ready");
		if (activeTab === "exported") return records.filter((record) => record.status === "exported");
		if (activeTab === "failed") {
			return records.filter((record) => record.status === "failed" || record.status === "permanently_failed");
		}
		return records.filter((record) => record.status === "retrying");
	}, [records, activeTab]);

	const metrics = useMemo(() => {
		const today = new Date().toISOString().slice(0, 10);
		const ready = records.filter((record) => record.status === "ready").length;
		const exportedToday = records.filter(
			(record) => record.status === "exported" && record.exportedAt?.startsWith(today),
		).length;
		const failed = records.filter((record) => record.status === "failed" || record.status === "permanently_failed").length;
		const retrying = records.filter((record) => record.status === "retrying").length;
		return { ready, exportedToday, failed, retrying };
	}, [records]);

	async function exportAllReady() {
		setBusy("all");
		setError(null);
		try {
			const response = await fetch("/api/exports/jobnimbus", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ all: true }),
			});
			const payload = await response.json();
			if (!response.ok || payload?.error) {
				throw new Error(payload?.error ?? "Failed to export ready records");
			}
			await load();
			setSelectedIds([]);
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Export failed");
		} finally {
			setBusy(null);
		}
	}

	async function exportSelected() {
		if (selectedIds.length === 0) return;
		setBusy("selected");
		setError(null);
		try {
			const response = await fetch("/api/exports/jobnimbus", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ exportIds: selectedIds }),
			});
			const payload = await response.json();
			if (!response.ok || payload?.error) {
				throw new Error(payload?.error ?? "Failed to export selected records");
			}
			await load();
			setSelectedIds([]);
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Export failed");
		} finally {
			setBusy(null);
		}
	}

	async function exportOne(id: string) {
		setBusy(id);
		setError(null);
		try {
			const response = await fetch("/api/exports/jobnimbus", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ exportId: id }),
			});
			const payload = await response.json();
			if (!response.ok || payload?.error) {
				throw new Error(payload?.error ?? "Failed to export record");
			}
			await load();
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Export failed");
		} finally {
			setBusy(null);
		}
	}

	async function retryOne(id: string) {
		setBusy(id);
		setError(null);
		try {
			const response = await fetch(`/api/exports/${id}/retry`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ resetAttempts: false }),
			});
			const payload = await response.json();
			if (!response.ok || payload?.error) {
				throw new Error(payload?.error ?? "Failed to retry export");
			}
			await load();
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Retry failed");
		} finally {
			setBusy(null);
		}
	}

	async function openPreview(id: string) {
		setBusy(`preview-${id}`);
		setError(null);
		try {
			const response = await fetch(`/api/exports/${id}/preview`);
			const payload = await response.json();
			if (!response.ok || payload?.error) {
				throw new Error(payload?.error ?? "Failed to load preview");
			}
			setPreview(payload?.data ?? null);
		} catch (previewError) {
			setError(previewError instanceof Error ? previewError.message : "Preview failed");
		} finally {
			setBusy(null);
		}
	}

	if (loading && records.length === 0) {
		return <LoadingState title="Loading exports…" description="Syncing JobNimbus export queue." />;
	}

	if (error && records.length === 0) {
		return <ErrorState title="Unable to load exports" description={error} />;
	}

	return (
		<div className="space-y-5">
			{error ? <ErrorState title="Exports action failed" description={error} /> : null}
			<header className="rounded-2xl border border-storm-border bg-storm-z2 p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-2xl font-bold text-white">Exports</h1>
						<p className="text-sm text-storm-muted">JobNimbus export queue with retry handling and handoff previews.</p>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="secondary" onClick={() => void load()}>
							<RefreshCw className="mr-1 h-4 w-4" />
							Refresh
						</Button>
						<Button onClick={exportAllReady} disabled={busy === "all" || metrics.ready === 0}>
							<Upload className="mr-1 h-4 w-4" />
							{busy === "all" ? "Exporting..." : "Export All Ready"}
						</Button>
					</div>
				</div>
				<div className="mt-4 flex flex-wrap gap-2">
					<Badge variant="purple">Ready: {metrics.ready}</Badge>
					<Badge variant="success">Exported Today: {metrics.exportedToday}</Badge>
					<Badge variant="danger">Failed: {metrics.failed}</Badge>
					<Badge variant="info">Retry Queue: {metrics.retrying}</Badge>
				</div>
			</header>

			<Card>
				<CardHeader>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<CardTitle>Export Queue</CardTitle>
						{selectedIds.length > 0 ? (
							<Button size="sm" onClick={exportSelected} disabled={busy === "selected"}>
								<Send className="mr-1 h-4 w-4" />
								{busy === "selected" ? "Exporting Selected..." : `Export Selected (${selectedIds.length})`}
							</Button>
						) : null}
					</div>
					<div className="mt-2 flex flex-wrap gap-2">
						{TABS.map((tab) => (
							<Button
								key={tab.key}
								size="sm"
								variant={activeTab === tab.key ? "primary" : "secondary"}
								onClick={() => setActiveTab(tab.key)}
							>
								{tab.label}
							</Button>
						))}
					</div>
				</CardHeader>
				<CardContent className="space-y-2">
					{loading ? <LoadingState title="Refreshing exports…" description="Checking latest statuses." /> : null}
					{!loading && filtered.length === 0 ? (
						<EmptyState title="No records in this section" description="Try a different tab or refresh shortly." />
					) : null}

					{filtered.map((record) => {
						const checked = selectedIds.includes(record.id);
						const address = record.payload?.contact?.address_line1 ?? "Unknown address";
						const homeowner = record.payload?.contact?.display_name ?? "Unknown homeowner";
						return (
							<div key={record.id} className="rounded-xl border border-storm-border bg-storm-z1 p-3">
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div>
										<p className="text-sm font-semibold text-white">{address}</p>
										<p className="text-xs text-storm-muted">{homeowner}</p>
										<p className="text-xs text-storm-subtle">Attempts: {record.attempts}</p>
										{record.error ? <p className="text-xs text-red-400">{record.error}</p> : null}
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant={statusBadge(record.status)}>{record.status}</Badge>
										{record.status === "ready" ? (
											<input
												type="checkbox"
												checked={checked}
												onChange={(event) => {
													if (event.target.checked) {
														setSelectedIds((prev) => [...prev, record.id]);
													} else {
														setSelectedIds((prev) => prev.filter((id) => id !== record.id));
													}
												}}
											/>
										) : null}
										<Button size="sm" variant="secondary" onClick={() => void openPreview(record.id)}>
											<Eye className="mr-1 h-4 w-4" />
											Preview
										</Button>
										{record.status === "ready" ? (
											<Button size="sm" onClick={() => void exportOne(record.id)} disabled={busy === record.id}>
												{busy === record.id ? "Exporting..." : "Export"}
											</Button>
										) : null}
										{record.status === "failed" || record.status === "permanently_failed" ? (
											<Button size="sm" onClick={() => void retryOne(record.id)} disabled={busy === record.id}>
												{busy === record.id ? "Retrying..." : "Retry"}
											</Button>
										) : null}
									</div>
								</div>
							</div>
						);
					})}
				</CardContent>
			</Card>

			{preview ? (
				<div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l border-storm-border bg-storm-z2 shadow-2xl">
					<div className="flex h-full flex-col">
						<div className="flex items-center justify-between border-b border-storm-border px-5 py-4">
							<h2 className="text-lg font-semibold text-white">Handoff Summary Preview</h2>
									<Button aria-label="Close handoff summary preview" variant="ghost" size="sm" onClick={() => setPreview(null)}>Close</Button>
						</div>
						<div className="space-y-4 overflow-y-auto px-5 py-4">
							<div className="rounded-xl border border-storm-border bg-storm-z1 p-3 text-sm text-storm-muted">
								<p className="font-semibold text-white">{preview.payload.contact.display_name}</p>
								<p>{preview.payload.contact.address_line1}</p>
								<p>{preview.payload.contact.city}, {preview.payload.contact.state_text} {preview.payload.contact.zip}</p>
							</div>
							<div className="rounded-xl border border-storm-border bg-storm-z1 p-3 text-sm text-storm-muted">
								<p className="mb-1 text-xs uppercase text-storm-subtle">AI Handoff Summary</p>
								<p className="whitespace-pre-wrap">{preview.handoffSummary}</p>
							</div>
							<div className="rounded-xl border border-storm-border bg-storm-z1 p-3 text-sm text-storm-muted">
								<p className="mb-1 text-xs uppercase text-storm-subtle">Validation Warnings</p>
								{preview.validationWarnings.length === 0 ? (
									<p>No warnings.</p>
								) : (
									<ul className="list-disc pl-4">
										{preview.validationWarnings.map((warning) => (
											<li key={warning}>{warning}</li>
										))}
									</ul>
								)}
							</div>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
