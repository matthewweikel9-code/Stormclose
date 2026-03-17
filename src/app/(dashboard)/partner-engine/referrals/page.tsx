"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, RefreshCw, FlaskConical } from "lucide-react";
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

interface Partner {
	id: string;
	name: string;
}

const STATUSES = [
	"received",
	"contacted",
	"inspection_scheduled",
	"inspection_complete",
	"claim_filed",
	"approved",
	"roof_installed",
	"closed",
	"lost",
];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const SOURCES = ["partner_link", "manual", "storm_alert", "api"];

const STATUS_COLORS: Record<string, string> = {
	received: "bg-slate-500/20 text-slate-300",
	contacted: "bg-blue-500/20 text-blue-300",
	inspection_scheduled: "bg-cyan-500/20 text-cyan-300",
	inspection_complete: "bg-teal-500/20 text-teal-300",
	claim_filed: "bg-amber-500/20 text-amber-300",
	approved: "bg-orange-500/20 text-orange-300",
	roof_installed: "bg-emerald-500/20 text-emerald-300",
	closed: "bg-emerald-600/20 text-emerald-400",
	lost: "bg-red-500/20 text-red-300",
};

const STATUS_DOT_COLORS: Record<string, string> = {
	received: "bg-slate-500",
	contacted: "bg-blue-500",
	inspection_scheduled: "bg-cyan-500",
	inspection_complete: "bg-teal-500",
	claim_filed: "bg-amber-500",
	approved: "bg-orange-500",
	roof_installed: "bg-emerald-500",
	closed: "bg-emerald-600",
	lost: "bg-red-500",
};

const PRIORITY_COLORS: Record<string, string> = {
	low: "bg-storm-z2 text-storm-muted",
	normal: "bg-storm-z2 text-storm-muted",
	high: "bg-amber-500/20 text-amber-300",
	urgent: "bg-red-500/20 text-red-300",
};

function formatCurrency(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(n);
}

function formatDate(s: string | null) {
	if (!s) return "—";
	return new Date(s).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function statusLabel(s: string) {
	return s.replace(/_/g, " ");
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

	// Form state
	const [form, setForm] = useState({
		partnerId: "",
		propertyAddress: "",
		homeownerName: "",
		homeownerPhone: "",
		homeownerEmail: "",
		city: "",
		state: "",
		zip: "",
		priority: "normal",
		notes: "",
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
			try {
				await Promise.all([fetchReferrals(), fetchPartners()]);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Failed to load referrals");
			} finally {
				setLoading(false);
			}
		})();
	}, [fetchReferrals, fetchPartners]);

	const pipelineCounts = referrals.reduce(
		(acc, r) => {
			acc[r.status] = (acc[r.status] ?? 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setFormError(null);
		try {
			const res = await fetch("/api/partner-engine/referrals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					partnerId: form.partnerId || null,
					propertyAddress: form.propertyAddress,
					homeownerName: form.homeownerName || null,
					homeownerPhone: form.homeownerPhone || null,
					homeownerEmail: form.homeownerEmail || null,
					city: form.city || null,
					state: form.state || null,
					zip: form.zip || null,
					priority: form.priority,
					notes: form.notes || null,
				}),
			});
			const json = (await res.json()) as ApiEnvelope<Referral>;
			if (json.error) throw new Error(json.error);
			setForm({
				partnerId: "",
				propertyAddress: "",
				homeownerName: "",
				homeownerPhone: "",
				homeownerEmail: "",
				city: "",
				state: "",
				zip: "",
				priority: "normal",
				notes: "",
			});
			setShowForm(false);
			void fetchReferrals();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : "Failed to create referral");
		} finally {
			setSubmitting(false);
		}
	};

	const handleStatusChange = async (
		id: string,
		status: string,
		lostReason?: string
	) => {
		try {
			const res = await fetch("/api/partner-engine/referrals", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id,
					status,
					...(status === "lost" && lostReason !== undefined
						? { lostReason: lostReason || null }
						: {}),
				}),
			});
			const json = (await res.json()) as ApiEnvelope<Referral>;
			if (json.error) throw new Error(json.error);
			setLostReasonInputs((prev) => {
				const next = { ...prev };
				delete next[id];
				return next;
			});
			void fetchReferrals();
		} catch {
			// ignore
		}
	};

	const handleSync = async (id: string) => {
		setSyncingId(id);
		try {
			const res = await fetch(`/api/partner-engine/referrals/${id}/sync`, {
				method: "POST",
			});
			if (!res.ok) {
				const json = (await res.json()) as ApiEnvelope<null>;
				throw new Error(json.error ?? "Sync failed");
			}
			void fetchReferrals();
		} catch {
			// ignore
		} finally {
			setSyncingId(null);
		}
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
		} finally {
			setSeeding(false);
		}
	};

	if (loading && referrals.length === 0) {
		return (
			<div className="flex min-h-[40vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-storm-purple" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-xl font-bold text-white">Referrals</h1>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => void handleSeedMock()}
						disabled={seeding}
						className="inline-flex items-center gap-2 rounded-xl border border-storm-border bg-storm-z1 px-4 py-2.5 text-sm font-medium text-storm-muted transition-colors hover:bg-storm-z2 hover:text-white disabled:opacity-50"
						title="Create a test referral and sync it to JobNimbus"
					>
						{seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
						Create Test Referral & Sync
					</button>
					<button
						type="button"
						onClick={() => setShowForm(!showForm)}
						className="inline-flex items-center gap-2 rounded-xl bg-storm-purple px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-storm-purple/90"
					>
						<Plus className="h-4 w-4" />
						Add Referral
					</button>
				</div>
			</div>

			{seedResult && (
				<div
					className={`rounded-xl border p-4 ${
						seedResult.synced
							? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
							: "border-amber-500/30 bg-amber-500/10 text-amber-400"
					}`}
				>
					{seedResult.synced ? (
						<p className="text-sm font-medium">Test referral created and synced to JobNimbus. Check your JobNimbus contacts.</p>
					) : (
						<p className="text-sm font-medium">{seedResult.syncError ?? "Test referral created. Sync failed."}</p>
					)}
				</div>
			)}

			{/* Pipeline Summary Bar */}
			<div className="rounded-2xl border border-storm-border bg-storm-z1 p-4">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-storm-muted mb-3">
					Pipeline
				</h3>
				<div className="flex flex-wrap gap-4">
					{STATUSES.map((s) => (
						<span key={s} className="flex items-center gap-2">
							<span
								className={`h-2 w-2 rounded-full ${
									STATUS_DOT_COLORS[s] ?? "bg-storm-subtle"
								}`}
							/>
							<span className="text-sm text-storm-muted">
								{statusLabel(s)}: {pipelineCounts[s] ?? 0}
							</span>
						</span>
					))}
				</div>
			</div>

			{/* Inline Add Form */}
			{showForm && (
				<form
					onSubmit={(e) => void handleSubmit(e)}
					className="rounded-2xl border border-storm-border bg-storm-z1 p-6"
				>
					<h3 className="text-sm font-semibold text-white">New Referral</h3>
					{formError && (
						<div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
							{formError}
						</div>
					)}
					<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<div className="sm:col-span-2">
							<label className="block text-xs font-medium text-storm-muted">
								Partner
							</label>
							<select
								value={form.partnerId}
								onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
							>
								<option value="">— Select partner —</option>
								{partners.map((p) => (
									<option key={p.id} value={p.id}>
										{p.name}
									</option>
								))}
							</select>
						</div>
						<div className="sm:col-span-2">
							<label className="block text-xs font-medium text-storm-muted">
								Property Address *
							</label>
							<input
								required
								value={form.propertyAddress}
								onChange={(e) =>
									setForm((f) => ({ ...f, propertyAddress: e.target.value }))
								}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="123 Main St"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">
								Homeowner Name
							</label>
							<input
								value={form.homeownerName}
								onChange={(e) =>
									setForm((f) => ({ ...f, homeownerName: e.target.value }))
								}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="John Smith"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">
								Homeowner Phone
							</label>
							<input
								value={form.homeownerPhone}
								onChange={(e) =>
									setForm((f) => ({ ...f, homeownerPhone: e.target.value }))
								}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="(555) 123-4567"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">
								Homeowner Email
							</label>
							<input
								type="email"
								value={form.homeownerEmail}
								onChange={(e) =>
									setForm((f) => ({ ...f, homeownerEmail: e.target.value }))
								}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="john@example.com"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">City</label>
							<input
								value={form.city}
								onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="Dallas"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">State</label>
							<input
								value={form.state}
								onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="TX"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">ZIP</label>
							<input
								value={form.zip}
								onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="75201"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">
								Priority
							</label>
							<select
								value={form.priority}
								onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
							>
								{PRIORITIES.map((p) => (
									<option key={p} value={p}>
										{p}
									</option>
								))}
							</select>
						</div>
						<div className="sm:col-span-2 lg:col-span-3">
							<label className="block text-xs font-medium text-storm-muted">Notes</label>
							<textarea
								value={form.notes}
								onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
								rows={2}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="Notes..."
							/>
						</div>
					</div>
					<div className="mt-4 flex gap-2">
						<button
							type="submit"
							disabled={submitting}
							className="rounded-xl bg-storm-purple px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-storm-purple/90 disabled:opacity-50"
						>
							{submitting ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Create Referral"
							)}
						</button>
						<button
							type="button"
							onClick={() => setShowForm(false)}
							className="rounded-xl border border-storm-border bg-storm-z0 px-4 py-2.5 text-sm font-medium text-storm-muted transition-colors hover:bg-storm-z2"
						>
							Cancel
						</button>
					</div>
				</form>
			)}

			{/* Filters */}
			<div className="flex flex-wrap gap-3">
				<select
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-xl border border-storm-border bg-storm-z1 px-4 py-2.5 text-sm text-white focus:border-storm-purple focus:outline-none"
				>
					<option value="">All statuses</option>
					{STATUSES.map((s) => (
						<option key={s} value={s}>
							{statusLabel(s)}
						</option>
					))}
				</select>
				<select
					value={partnerFilter}
					onChange={(e) => setPartnerFilter(e.target.value)}
					className="rounded-xl border border-storm-border bg-storm-z1 px-4 py-2.5 text-sm text-white focus:border-storm-purple focus:outline-none"
				>
					<option value="">All partners</option>
					{partners.map((p) => (
						<option key={p.id} value={p.id}>
							{p.name}
						</option>
					))}
				</select>
				<select
					value={priorityFilter}
					onChange={(e) => setPriorityFilter(e.target.value)}
					className="rounded-xl border border-storm-border bg-storm-z1 px-4 py-2.5 text-sm text-white focus:border-storm-purple focus:outline-none"
				>
					<option value="">All priorities</option>
					{PRIORITIES.map((p) => (
						<option key={p} value={p}>
							{p}
						</option>
					))}
				</select>
				<select
					value={sourceFilter}
					onChange={(e) => setSourceFilter(e.target.value)}
					className="rounded-xl border border-storm-border bg-storm-z1 px-4 py-2.5 text-sm text-white focus:border-storm-purple focus:outline-none"
				>
					<option value="">All sources</option>
					{SOURCES.map((s) => (
						<option key={s} value={s}>
							{s.replace(/_/g, " ")}
						</option>
					))}
				</select>
			</div>

			{error && (
				<div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
					{error}
				</div>
			)}

			{/* Referrals Table */}
			<div className="overflow-hidden rounded-2xl border border-storm-border bg-storm-z1">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-storm-border text-left text-storm-subtle">
								<th className="px-6 py-3 font-medium">Property</th>
								<th className="px-6 py-3 font-medium">Homeowner</th>
								<th className="px-6 py-3 font-medium">Partner</th>
								<th className="px-6 py-3 font-medium">Status</th>
								<th className="px-6 py-3 font-medium">Priority</th>
								<th className="px-6 py-3 font-medium">Value</th>
								<th className="px-6 py-3 font-medium">CRM Sync</th>
								<th className="px-6 py-3 font-medium">Created</th>
								<th className="px-6 py-3 font-medium">Actions</th>
							</tr>
						</thead>
						<tbody>
							{referrals.length === 0 ? (
								<tr>
									<td colSpan={9} className="px-6 py-12 text-center text-storm-muted">
										No referrals found
									</td>
								</tr>
							) : (
								referrals.map((r) => (
									<tr
										key={r.id}
										className="border-b border-storm-border/50 hover:bg-storm-z0/50"
									>
										<td className="px-6 py-3 font-medium text-white">
											{r.propertyAddress}
										</td>
										<td className="px-6 py-3 text-storm-muted">
											{r.homeownerName ?? "—"}
										</td>
										<td className="px-6 py-3 text-storm-muted">
											{r.partnerName ?? "—"}
										</td>
										<td className="px-6 py-3">
											{lostReasonInputs[r.id] !== undefined ? (
												<div className="flex flex-col gap-1">
													<input
														placeholder="Lost reason"
														value={lostReasonInputs[r.id] ?? ""}
														onChange={(e) =>
															setLostReasonInputs((prev) => ({
																...prev,
																[r.id]: e.target.value,
															}))
														}
														className="w-32 rounded border border-storm-border bg-storm-z0 px-2 py-1 text-xs text-white"
													/>
													<div className="flex gap-1">
														<button
															type="button"
															onClick={() =>
																void handleStatusChange(
																	r.id,
																	"lost",
																	lostReasonInputs[r.id]
																)
															}
															className="text-xs text-red-400 hover:underline"
														>
															Save
														</button>
														<button
															type="button"
															onClick={() =>
																setLostReasonInputs((prev) => {
																	const next = { ...prev };
																	delete next[r.id];
																	return next;
																})
															}
															className="text-xs text-storm-muted hover:underline"
														>
															Cancel
														</button>
													</div>
												</div>
											) : (
												<select
													value={r.status}
													onChange={(e) => {
														const v = e.target.value;
														if (v === "lost") {
															setLostReasonInputs((prev) => ({ ...prev, [r.id]: "" }));
														} else {
															void handleStatusChange(r.id, v);
														}
													}}
													className={`rounded border bg-transparent px-2 py-1 text-xs ${
														STATUS_COLORS[r.status] ?? "text-storm-muted"
													}`}
												>
													{STATUSES.map((s) => (
														<option key={s} value={s}>
															{statusLabel(s)}
														</option>
													))}
												</select>
											)}
										</td>
										<td className="px-6 py-3">
											<span
												className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
													PRIORITY_COLORS[r.priority] ?? PRIORITY_COLORS.normal
												}`}
											>
												{r.priority}
											</span>
										</td>
										<td className="px-6 py-3 text-emerald-400">
											{formatCurrency(r.contractValue)}
										</td>
										<td className="px-6 py-3">
											{r.lastSyncedAt ? (
												<Badge variant="success">Synced</Badge>
											) : r.syncError ? (
												<Badge variant="danger">Error</Badge>
											) : (
												<Badge variant="outline">—</Badge>
											)}
										</td>
										<td className="px-6 py-3 text-storm-muted">
											{formatDate(r.createdAt)}
										</td>
										<td className="px-6 py-3">
											<button
												type="button"
												onClick={() => void handleSync(r.id)}
												disabled={!!r.lastSyncedAt || syncingId === r.id}
												className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-storm-glow hover:bg-storm-z2 disabled:opacity-50"
											>
												{syncingId === r.id ? (
													<Loader2 className="h-3 w-3 animate-spin" />
												) : (
													<RefreshCw className="h-3 w-3" />
												)}
												Sync to JobNimbus
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
