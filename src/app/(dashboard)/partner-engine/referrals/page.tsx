"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, RefreshCw, FlaskConical, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ApiEnvelope<T> = { data: T | null; error: string | null; meta: Record<string, unknown> };

interface Referral {
	id: string;
	partnerId: string | null;
	partnerName: string | null;
	homeownerName: string | null;
	homeownerPhone: string | null;
	homeownerEmail: string | null;
	propertyAddress: string;
	city: string | null;
	state: string | null;
	zip: string | null;
	status: string;
	priority: string;
	source: string;
	contractValue: number;
	lastSyncedAt: string | null;
	syncError: string | null;
	externalRecordId: string | null;
	createdAt: string | null;
}

interface Partner { id: string; name: string; }

const STATUSES = ["received", "contacted", "inspection_scheduled", "inspection_complete", "claim_filed", "approved", "roof_installed", "closed", "lost"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const SOURCES = ["partner_link", "manual", "storm_alert", "api"];

const STATUS_DOT_COLORS: Record<string, string> = {
	received: "bg-slate-500", contacted: "bg-blue-500", inspection_scheduled: "bg-cyan-500",
	inspection_complete: "bg-teal-500", claim_filed: "bg-amber-500", approved: "bg-orange-500",
	roof_installed: "bg-emerald-500", closed: "bg-emerald-600", lost: "bg-red-500",
};

const STATUS_BORDER: Record<string, string> = {
	received: "border-l-slate-500", contacted: "border-l-blue-500", inspection_scheduled: "border-l-cyan-500",
	inspection_complete: "border-l-teal-500", claim_filed: "border-l-amber-500", approved: "border-l-orange-500",
	roof_installed: "border-l-emerald-500", closed: "border-l-emerald-600", lost: "border-l-red-500",
};

const STATUS_BADGE: Record<string, "default" | "info" | "warning" | "success" | "danger" | "purple"> = {
	received: "default", contacted: "info", inspection_scheduled: "info",
	inspection_complete: "info", claim_filed: "warning", approved: "warning",
	roof_installed: "success", closed: "success", lost: "danger",
};

const PRIORITY_BADGE: Record<string, "default" | "warning" | "danger"> = {
	low: "default", normal: "default", high: "warning", urgent: "danger",
};

function formatCurrency(n: number) {
	return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function formatDate(s: string | null) {
	if (!s) return "—";
	return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(s: string) { return s.replace(/_/g, " "); }

function SkeletonRows({ count = 5 }: { count?: number }) {
	return (
		<div className="space-y-3 p-4">
			{Array.from({ length: count }).map((_, i) => (
				<div key={i} className="flex items-center gap-3">
					<div className="skeleton h-2 w-2 rounded-full" />
					<div className="flex-1 space-y-2">
						<div className="skeleton h-4 w-3/4 rounded" />
						<div className="skeleton h-2 w-1/2 rounded" />
					</div>
				</div>
			))}
		</div>
	);
}

export default function ReferralsPage() {
	const [referrals, setReferrals] = useState<Referral[]>([]);
	const [partners, setPartners] = useState<Partner[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [statusFilter, setStatusFilter] = useState("");
	const [partnerFilter, setPartnerFilter] = useState("");
	const [priorityFilter, setPriorityFilter] = useState("");
	const [sourceFilter, setSourceFilter] = useState("");
	const [syncingId, setSyncingId] = useState<string | null>(null);
	const [lostReasonInputs, setLostReasonInputs] = useState<Record<string, string>>({});
	const [seeding, setSeeding] = useState(false);
	const [seedResult, setSeedResult] = useState<{ synced?: boolean; syncError?: string } | null>(null);

	const [form, setForm] = useState({
		partnerId: "", propertyAddress: "", homeownerName: "", homeownerPhone: "",
		homeownerEmail: "", city: "", state: "", zip: "", priority: "normal", notes: "",
	});
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const fetchReferrals = useCallback(async () => {
		const params = new URLSearchParams();
		if (statusFilter) params.set("status", statusFilter);
		if (partnerFilter) params.set("partnerId", partnerFilter);
		if (priorityFilter) params.set("priority", priorityFilter);
		if (sourceFilter) params.set("source", sourceFilter);
		const res = await fetch(`/api/partner-engine/referrals?${params}`);
		const json = (await res.json()) as ApiEnvelope<Referral[]>;
		if (json.error) throw new Error(json.error);
		setReferrals(json.data ?? []);
	}, [statusFilter, partnerFilter, priorityFilter, sourceFilter]);

	const fetchPartners = useCallback(async () => {
		const res = await fetch("/api/partner-engine/partners");
		const json = (await res.json()) as ApiEnvelope<Partner[]>;
		if (json.error) return;
		setPartners(json.data ?? []);
	}, []);

	useEffect(() => {
		void (async () => {
			setLoading(true);
			try { await Promise.all([fetchReferrals(), fetchPartners()]); } catch (e) { setError(e instanceof Error ? e.message : "Failed to load referrals"); } finally { setLoading(false); }
		})();
	}, [fetchReferrals, fetchPartners]);

	const pipelineCounts = referrals.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setFormError(null);
		try {
			const res = await fetch("/api/partner-engine/referrals", {
				method: "POST", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					partnerId: form.partnerId || null, propertyAddress: form.propertyAddress,
					homeownerName: form.homeownerName || null, homeownerPhone: form.homeownerPhone || null,
					homeownerEmail: form.homeownerEmail || null, city: form.city || null,
					state: form.state || null, zip: form.zip || null, priority: form.priority, notes: form.notes || null,
				}),
			});
			const json = (await res.json()) as ApiEnvelope<Referral>;
			if (json.error) throw new Error(json.error);
			setForm({ partnerId: "", propertyAddress: "", homeownerName: "", homeownerPhone: "", homeownerEmail: "", city: "", state: "", zip: "", priority: "normal", notes: "" });
			setShowForm(false);
			void fetchReferrals();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : "Failed to create referral");
		} finally { setSubmitting(false); }
	};

	const handleStatusChange = async (id: string, status: string, lostReason?: string) => {
		try {
			const res = await fetch("/api/partner-engine/referrals", {
				method: "PATCH", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, status, ...(status === "lost" && lostReason !== undefined ? { lostReason: lostReason || null } : {}) }),
			});
			const json = (await res.json()) as ApiEnvelope<Referral>;
			if (json.error) throw new Error(json.error);
			setLostReasonInputs((prev) => { const next = { ...prev }; delete next[id]; return next; });
			void fetchReferrals();
		} catch { /* ignore */ }
	};

	const handleSync = async (id: string) => {
		setSyncingId(id);
		try {
			const res = await fetch(`/api/partner-engine/referrals/${id}/sync`, { method: "POST" });
			if (!res.ok) { const json = (await res.json()) as ApiEnvelope<null>; throw new Error(json.error ?? "Sync failed"); }
			void fetchReferrals();
		} catch { /* ignore */ } finally { setSyncingId(null); }
	};

	const handleSeedMock = async () => {
		setSeeding(true);
		setSeedResult(null);
		try {
			const res = await fetch("/api/partner-engine/seed-mock-referral", { method: "POST" });
			const json = (await res.json()) as { data?: { synced?: boolean; syncError?: string }; error?: string };
			if (!res.ok) throw new Error(json.error ?? "Failed to create mock referral");
			setSeedResult({ synced: json.data?.synced, syncError: json.data?.syncError ?? undefined });
			void fetchReferrals();
		} catch (e) {
			setSeedResult({ syncError: e instanceof Error ? e.message : "Failed" });
		} finally { setSeeding(false); }
	};

	if (loading && referrals.length === 0) {
		return (
			<div className="space-y-5 animate-fade-in">
				<div className="flex justify-between"><div className="skeleton h-8 w-32 rounded-lg" /><div className="skeleton h-10 w-40 rounded-xl" /></div>
				<div className="storm-card"><SkeletonRows count={6} /></div>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<ArrowRight className="h-5 w-5 text-storm-glow" />
					<h1 className="text-lg font-bold text-white">Referrals</h1>
					{referrals.length > 0 && <Badge variant="default">{referrals.length}</Badge>}
				</div>
				<div className="flex flex-wrap gap-2">
					<button type="button" onClick={() => void handleSeedMock()} disabled={seeding} className="button-secondary flex items-center gap-2 text-sm" title="Create a test referral and sync it to JobNimbus">
						{seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
						Test Referral & Sync
					</button>
					<button type="button" onClick={() => setShowForm(!showForm)} className="button-primary flex items-center gap-2 text-sm">
						<Plus className="h-4 w-4" />
						Add Referral
					</button>
				</div>
			</div>

			{seedResult && (
				<div className={`rounded-xl border p-4 ${seedResult.synced ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}`}>
					{seedResult.synced
						? <p className="text-sm font-medium">Test referral created and synced to JobNimbus.</p>
						: <p className="text-sm font-medium">{seedResult.syncError ?? "Test referral created. Sync failed."}</p>}
				</div>
			)}

			{/* Pipeline Summary */}
			<div className="glass rounded-2xl p-4">
				<h3 className="text-2xs uppercase tracking-wider text-storm-subtle font-medium mb-3">Pipeline</h3>
				<div className="flex flex-wrap gap-x-4 gap-y-1.5">
					{STATUSES.map((s) => (
						<span key={s} className="flex items-center gap-2">
							<span className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[s] ?? "bg-storm-subtle"}`} />
							<span className="text-xs text-storm-muted">{statusLabel(s)}: <span className="text-white font-medium tabular-nums">{pipelineCounts[s] ?? 0}</span></span>
						</span>
					))}
				</div>
			</div>

			{showForm && (
				<form onSubmit={(e) => void handleSubmit(e)} className="storm-card p-5">
					<h3 className="text-sm font-semibold text-white mb-3">New Referral</h3>
					{formError && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{formError}</div>}
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						<div className="sm:col-span-2">
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Partner</label>
							<select value={form.partnerId} onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))} className="dashboard-select">
								<option value="">— Select partner —</option>
								{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
							</select>
						</div>
						<div className="sm:col-span-2">
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Property Address *</label>
							<input required value={form.propertyAddress} onChange={(e) => setForm((f) => ({ ...f, propertyAddress: e.target.value }))} className="dashboard-input" placeholder="123 Main St" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Homeowner Name</label>
							<input value={form.homeownerName} onChange={(e) => setForm((f) => ({ ...f, homeownerName: e.target.value }))} className="dashboard-input" placeholder="John Smith" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Homeowner Phone</label>
							<input value={form.homeownerPhone} onChange={(e) => setForm((f) => ({ ...f, homeownerPhone: e.target.value }))} className="dashboard-input" placeholder="(555) 123-4567" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Homeowner Email</label>
							<input type="email" value={form.homeownerEmail} onChange={(e) => setForm((f) => ({ ...f, homeownerEmail: e.target.value }))} className="dashboard-input" placeholder="john@example.com" />
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
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Priority</label>
							<select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="dashboard-select">
								{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
							</select>
						</div>
						<div className="sm:col-span-2 lg:col-span-3">
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Notes</label>
							<textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="dashboard-textarea" placeholder="Notes..." />
						</div>
					</div>
					<div className="mt-4 flex gap-2">
						<button type="submit" disabled={submitting} className="button-primary text-sm">
							{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Referral"}
						</button>
						<button type="button" onClick={() => setShowForm(false)} className="button-secondary text-sm">Cancel</button>
					</div>
				</form>
			)}

			{/* Filters */}
			<div className="glass rounded-2xl p-3 flex flex-wrap gap-3">
				<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="dashboard-select">
					<option value="">All statuses</option>
					{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
				</select>
				<select value={partnerFilter} onChange={(e) => setPartnerFilter(e.target.value)} className="dashboard-select">
					<option value="">All partners</option>
					{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
				</select>
				<select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="dashboard-select">
					<option value="">All priorities</option>
					{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
				</select>
				<select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="dashboard-select">
					<option value="">All sources</option>
					{SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
				</select>
			</div>

			{error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">{error}</div>}

			{/* Referrals List */}
			<div className="storm-card overflow-hidden">
				<div className="glow-line" />
				{referrals.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16">
						<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-storm-z2 mb-3">
							<ArrowRight className="h-7 w-7 text-storm-subtle" />
						</div>
						<p className="text-sm font-medium text-white">No referrals found</p>
						<p className="text-xs text-storm-subtle mt-1">Add a referral or adjust your filters</p>
					</div>
				) : (
					<div className="stagger-children">
						{referrals.map((r) => (
							<div key={r.id} className={`flex items-start gap-3 px-4 py-3.5 hover:bg-storm-z2/30 transition-colors border-l-2 ${STATUS_BORDER[r.status] ?? "border-l-storm-subtle"} border-b border-storm-border/20 last:border-b-0`}>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="text-sm font-medium text-white truncate">{r.propertyAddress}</span>
										<Badge variant={STATUS_BADGE[r.status] ?? "default"}>{statusLabel(r.status)}</Badge>
										<Badge variant={PRIORITY_BADGE[r.priority] ?? "default"}>{r.priority}</Badge>
									</div>
									<p className="text-2xs text-storm-subtle mt-0.5">
										{r.homeownerName ?? "Unknown"} · {r.partnerName ?? "Direct"} · {formatDate(r.createdAt)}
									</p>
								</div>
								<div className="flex items-center gap-3 flex-shrink-0">
									{r.lastSyncedAt ? (
										<Badge variant="success">Synced</Badge>
									) : r.syncError ? (
										<Badge variant="danger">Sync Error</Badge>
									) : null}
									<span className="text-sm font-medium text-emerald-400 tabular-nums">{formatCurrency(r.contractValue)}</span>
								</div>
								<div className="flex items-center gap-2 flex-shrink-0">
									{lostReasonInputs[r.id] !== undefined ? (
										<div className="flex flex-col gap-1">
											<input
												placeholder="Lost reason"
												value={lostReasonInputs[r.id] ?? ""}
												onChange={(e) => setLostReasonInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
												className="dashboard-input text-xs w-32"
											/>
											<div className="flex gap-1">
												<button type="button" onClick={() => void handleStatusChange(r.id, "lost", lostReasonInputs[r.id])} className="text-2xs text-red-400 hover:underline">Save</button>
												<button type="button" onClick={() => setLostReasonInputs((prev) => { const next = { ...prev }; delete next[r.id]; return next; })} className="text-2xs text-storm-muted hover:underline">Cancel</button>
											</div>
										</div>
									) : (
										<select
											value={r.status}
											onChange={(e) => {
												const v = e.target.value;
												if (v === "lost") { setLostReasonInputs((prev) => ({ ...prev, [r.id]: "" })); }
												else { void handleStatusChange(r.id, v); }
											}}
											className="dashboard-select text-xs py-1 px-2"
										>
											{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
										</select>
									)}
									<button type="button" onClick={() => void handleSync(r.id)} disabled={!!r.lastSyncedAt || syncingId === r.id}
										className="button-secondary text-2xs px-2 py-1 flex items-center gap-1 disabled:opacity-40">
										{syncingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
										Sync
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
