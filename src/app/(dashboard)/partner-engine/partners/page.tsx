"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Plus, Copy, Check, Loader2, Users, Upload, Download, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UploadCard } from "@/components/dashboard/UploadCard";
import {
	parsePartnersFile,
	readFileAsText,
	readFileAsArrayBuffer,
	getPartnersTemplateCSV,
} from "@/lib/partner-engine/import-parser";

type ApiEnvelope<T> = { data: T | null; error: string | null; meta: Record<string, unknown> };

interface Partner {
	id: string;
	name: string;
	businessName: string | null;
	email: string | null;
	phone: string | null;
	partnerType: string;
	referralCode: string;
	status: string;
	tier: string;
	territory: string | null;
	totalReferrals: number;
	totalRevenue: number;
}

const PARTNER_TYPES = ["realtor", "insurance_agent", "home_inspector", "property_manager", "contractor", "other"];
const STATUSES = ["active", "paused", "archived"];
const TIERS = ["bronze", "silver", "gold", "platinum"];

const TIER_BADGE: Record<string, "warning" | "default" | "purple" | "info"> = {
	bronze: "default",
	silver: "info",
	gold: "warning",
	platinum: "purple",
};

function formatCurrency(n: number) {
	return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function SkeletonRows({ count = 4 }: { count?: number }) {
	return (
		<div className="space-y-3 p-4">
			{Array.from({ length: count }).map((_, i) => (
				<div key={i} className="flex items-center gap-3">
					<div className="skeleton h-10 w-10 rounded-xl" />
					<div className="flex-1 space-y-2">
						<div className="skeleton h-4 w-3/4 rounded" />
						<div className="skeleton h-2 w-1/2 rounded" />
					</div>
				</div>
			))}
		</div>
	);
}

export default function PartnersPage() {
	const [partners, setPartners] = useState<Partner[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [tierFilter, setTierFilter] = useState("");
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [companySlug, setCompanySlug] = useState("company");

	const [form, setForm] = useState({
		name: "", businessName: "", email: "", phone: "", partnerType: "other",
		territory: "", city: "", state: "", zip: "", tier: "bronze", notes: "",
	});
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const [showImport, setShowImport] = useState(false);
	const [importRows, setImportRows] = useState<{ name: string; businessName: string | null; email: string | null }[]>([]);
	const [importParseErrors, setImportParseErrors] = useState<string[]>([]);
	const [importParseWarnings, setImportParseWarnings] = useState<string[]>([]);
	const [importing, setImporting] = useState(false);
	const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

	const fetchPartners = useCallback(async () => {
		const params = new URLSearchParams();
		if (search) params.set("q", search);
		if (typeFilter) params.set("partnerType", typeFilter);
		if (statusFilter) params.set("status", statusFilter);
		if (tierFilter) params.set("tier", tierFilter);
		const res = await fetch(`/api/partner-engine/partners?${params}`);
		const json = (await res.json()) as ApiEnvelope<Partner[]>;
		if (json.error) throw new Error(json.error);
		setPartners(json.data ?? []);
	}, [search, typeFilter, statusFilter, tierFilter]);

	useEffect(() => {
		void (async () => {
			setLoading(true);
			try { await fetchPartners(); } catch (e) { setError(e instanceof Error ? e.message : "Failed to load partners"); } finally { setLoading(false); }
		})();
	}, [fetchPartners]);

	useEffect(() => {
		fetch("/api/partner-engine/settings")
			.then((r) => r.ok ? r.json() : null)
			.then((json: ApiEnvelope<{ companySlug: string }>) => {
				const slug = json?.data?.companySlug;
				if (slug) setCompanySlug(slug);
			})
			.catch(() => {});
	}, []);

	const handleCopy = async (referralCode: string, id: string) => {
		const baseUrl = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) : "";
		const url = `${baseUrl}/ref/${companySlug}/${referralCode}`;
		await navigator.clipboard.writeText(url);
		setCopiedId(id);
		setTimeout(() => setCopiedId(null), 2000);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setFormError(null);
		try {
			const res = await fetch("/api/partner-engine/partners", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: form.name, businessName: form.businessName || null, email: form.email || null,
					phone: form.phone || null, partnerType: form.partnerType, territory: form.territory || null,
					city: form.city || null, state: form.state || null, zip: form.zip || null,
					tier: form.tier, notes: form.notes || null,
				}),
			});
			const json = (await res.json()) as ApiEnvelope<Partner>;
			if (json.error) throw new Error(json.error);
			setForm({ name: "", businessName: "", email: "", phone: "", partnerType: "other", territory: "", city: "", state: "", zip: "", tier: "bronze", notes: "" });
			setShowForm(false);
			void fetchPartners();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : "Failed to create partner");
		} finally {
			setSubmitting(false);
		}
	};

	const handleStatusToggle = async (partner: Partner) => {
		const next = partner.status === "active" ? "paused" : partner.status === "paused" ? "archived" : "active";
		try {
			const res = await fetch("/api/partner-engine/partners", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: partner.id, status: next }),
			});
			const json = (await res.json()) as ApiEnvelope<Partner>;
			if (json.error) throw new Error(json.error);
			void fetchPartners();
		} catch { /* ignore */ }
	};

	const handleImportFileSelect = async (file: File) => {
		setImportResult(null);
		setImportParseErrors([]);
		setImportParseWarnings([]);
		try {
			const isExcel = file.name.toLowerCase().endsWith(".xlsx");
			const content = isExcel ? await readFileAsArrayBuffer(file) : await readFileAsText(file);
			const result = parsePartnersFile(content, isExcel);
			setImportParseErrors(result.errors);
			setImportParseWarnings(result.warnings);
			setImportRows(result.rows);
		} catch (e) {
			setImportParseErrors([e instanceof Error ? e.message : "Failed to parse file"]);
			setImportRows([]);
		}
	};

	const handleImport = async () => {
		if (importRows.length === 0) return;
		setImporting(true);
		setImportResult(null);
		try {
			const res = await fetch("/api/partner-engine/partners/import", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rows: importRows }),
			});
			const json = (await res.json()) as ApiEnvelope<{ imported: number; errors: string[] }>;
			if (json.error) throw new Error(json.error);
			setImportResult(json.data ?? { imported: 0, errors: [] });
			if (json.data?.imported) {
				void fetchPartners();
			}
		} catch (e) {
			setImportResult({ imported: 0, errors: [e instanceof Error ? e.message : "Import failed"] });
		} finally {
			setImporting(false);
		}
	};

	const handleDownloadTemplate = () => {
		const csv = getPartnersTemplateCSV();
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "partners-template.csv";
		a.click();
		URL.revokeObjectURL(url);
	};

	if (loading && partners.length === 0) {
		return (
			<div className="space-y-5 animate-fade-in">
				<div className="flex justify-between"><div className="skeleton h-8 w-32 rounded-lg" /><div className="skeleton h-10 w-36 rounded-xl" /></div>
				<div className="storm-card"><SkeletonRows count={6} /></div>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<Users className="h-5 w-5 text-storm-glow" />
					<h1 className="text-lg font-bold text-white">Partners</h1>
					{partners.length > 0 && <Badge variant="default">{partners.length}</Badge>}
				</div>
				<div className="flex flex-wrap gap-2">
					<button type="button" onClick={() => setShowImport(true)} className="button-secondary flex items-center gap-2 text-sm">
						<Upload className="h-4 w-4" />
						Import
					</button>
					<button type="button" onClick={() => setShowForm(!showForm)} className="button-primary flex items-center gap-2 text-sm">
						<Plus className="h-4 w-4" />
						Add Partner
					</button>
				</div>
			</div>

			{/* Import Modal */}
			{showImport && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowImport(false)}>
					<div className="storm-card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-semibold text-white">Import Partners</h3>
							<button type="button" onClick={() => setShowImport(false)} className="p-2 text-storm-subtle hover:text-white rounded-lg hover:bg-storm-z2">
								<X className="h-5 w-5" />
							</button>
						</div>
						<p className="text-sm text-storm-muted mb-4">Upload a CSV or Excel file. Required column: Name. Optional: Business Name, Email, Phone, Partner Type, Territory, City, State, ZIP, Tier, Notes.</p>
						<button type="button" onClick={handleDownloadTemplate} className="button-secondary flex items-center gap-2 text-sm mb-4">
							<Download className="h-4 w-4" />
							Download template
						</button>
						<UploadCard onFileSelect={handleImportFileSelect} accept=".csv,.xlsx" maxSize={5} isLoading={importing} />
						{importParseErrors.length > 0 && (
							<div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
								{importParseErrors.map((e, i) => <p key={i}>{e}</p>)}
							</div>
						)}
						{importParseWarnings.length > 0 && (
							<div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
								{importParseWarnings.map((w, i) => <p key={i}>{w}</p>)}
							</div>
						)}
						{importRows.length > 0 && importParseErrors.length === 0 && (
							<div className="mt-4">
								<p className="text-sm text-storm-muted mb-2">Preview ({importRows.length} partners):</p>
								<div className="rounded-xl bg-storm-z1 border border-storm-border max-h-40 overflow-y-auto">
									{importRows.slice(0, 10).map((r, i) => (
										<div key={i} className="px-3 py-2 border-b border-storm-border/50 last:border-b-0 text-sm text-storm-muted">
											{r.name}{r.businessName ? ` · ${r.businessName}` : ""}{r.email ? ` · ${r.email}` : ""}
										</div>
									))}
									{importRows.length > 10 && <div className="px-3 py-2 text-2xs text-storm-subtle">... and {importRows.length - 10} more</div>}
								</div>
								<button type="button" onClick={() => void handleImport()} disabled={importing} className="button-primary mt-4 flex items-center gap-2 text-sm">
									{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
									Import {importRows.length} partners
								</button>
							</div>
						)}
						{importResult && (
							<div className={`mt-4 rounded-xl border p-4 ${importResult.errors.length > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>
								<p className="text-sm font-medium">Imported {importResult.imported} partners.</p>
								{importResult.errors.length > 0 && <p className="text-sm mt-1">{importResult.errors.join(" ")}</p>}
							</div>
						)}
					</div>
				</div>
			)}

			{showForm && (
				<form onSubmit={(e) => void handleSubmit(e)} className="storm-card p-5">
					<h3 className="text-sm font-semibold text-white mb-3">New Partner</h3>
					{formError && (
						<div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{formError}</div>
					)}
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Name *</label>
							<input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="dashboard-input" placeholder="John Smith" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Business Name</label>
							<input value={form.businessName} onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))} className="dashboard-input" placeholder="ABC Realty" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Email</label>
							<input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="dashboard-input" placeholder="john@example.com" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Phone</label>
							<input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="dashboard-input" placeholder="(555) 123-4567" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Partner Type</label>
							<select value={form.partnerType} onChange={(e) => setForm((f) => ({ ...f, partnerType: e.target.value }))} className="dashboard-select">
								{PARTNER_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
							</select>
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Territory</label>
							<input value={form.territory} onChange={(e) => setForm((f) => ({ ...f, territory: e.target.value }))} className="dashboard-input" placeholder="North Dallas" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">City</label>
							<input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="dashboard-input" placeholder="Dallas" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">State</label>
							<input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} className="dashboard-input" placeholder="TX" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">ZIP</label>
							<input value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} className="dashboard-input" placeholder="75201" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Tier</label>
							<select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))} className="dashboard-select">
								{TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
							</select>
						</div>
						<div className="sm:col-span-2 lg:col-span-3">
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Notes</label>
							<textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="dashboard-textarea" placeholder="Notes..." />
						</div>
					</div>
					<div className="mt-4 flex gap-2">
						<button type="submit" disabled={submitting} className="button-primary text-sm">
							{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Partner"}
						</button>
						<button type="button" onClick={() => setShowForm(false)} className="button-secondary text-sm">Cancel</button>
					</div>
				</form>
			)}

			{/* Filters */}
			<div className="glass rounded-2xl p-3 flex flex-wrap gap-3">
				<div className="relative flex-1 min-w-[200px]">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-storm-subtle" />
					<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search partners..." className="dashboard-input pl-10" />
				</div>
				<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="dashboard-select">
					<option value="">All types</option>
					{PARTNER_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
				</select>
				<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="dashboard-select">
					<option value="">All statuses</option>
					{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
				</select>
				<select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="dashboard-select">
					<option value="">All tiers</option>
					{TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
				</select>
			</div>

			{error && (
				<div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">{error}</div>
			)}

			{/* Partners List */}
			<div className="storm-card overflow-hidden">
				<div className="glow-line" />
				{partners.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16">
						<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-storm-z2 mb-3">
							<Users className="h-7 w-7 text-storm-subtle" />
						</div>
						<p className="text-sm font-medium text-white">No partners found</p>
						<p className="text-xs text-storm-subtle mt-1">Add a partner to get started</p>
					</div>
				) : (
					<div className="stagger-children">
						{partners.map((p) => (
							<div key={p.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-storm-z2/30 transition-colors border-b border-storm-border/20 last:border-b-0">
								<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-storm-purple/20 to-storm-glow/10 text-sm font-bold text-storm-glow flex-shrink-0">
									{p.name.charAt(0).toUpperCase()}
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="text-sm font-medium text-white truncate">{p.name}</span>
										<Badge variant={TIER_BADGE[p.tier] ?? "default"}>{p.tier}</Badge>
										<Badge variant={p.status === "active" ? "success" : p.status === "paused" ? "warning" : "default"}>{p.status}</Badge>
									</div>
									<p className="text-2xs text-storm-subtle capitalize mt-0.5">
										{p.partnerType.replace(/_/g, " ")}{p.businessName ? ` · ${p.businessName}` : ""}{p.territory ? ` · ${p.territory}` : ""}
									</p>
								</div>
								<div className="hidden md:flex items-center gap-4 flex-shrink-0 text-right">
									<div>
										<p className="text-sm font-bold text-emerald-400 tabular-nums">{formatCurrency(p.totalRevenue)}</p>
										<p className="text-2xs text-storm-subtle">Revenue</p>
									</div>
									<div>
										<p className="text-sm font-medium text-white tabular-nums">{p.totalReferrals}</p>
										<p className="text-2xs text-storm-subtle">Referrals</p>
									</div>
								</div>
								<div className="flex items-center gap-2 flex-shrink-0">
									<button
										type="button"
										onClick={() => void handleCopy(p.referralCode, p.id)}
										className="rounded-lg p-2 text-storm-subtle hover:bg-storm-z2 hover:text-white transition-colors"
										title="Copy referral link"
									>
										{copiedId === p.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
									</button>
									<button
										type="button"
										onClick={() => void handleStatusToggle(p)}
										className="text-2xs font-medium text-storm-glow hover:text-storm-purple transition-colors"
									>
										{p.status === "active" ? "Pause" : p.status === "paused" ? "Archive" : "Activate"}
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
