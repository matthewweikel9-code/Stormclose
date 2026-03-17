"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Plus, Copy, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

const PARTNER_TYPES = [
	"realtor",
	"insurance_agent",
	"home_inspector",
	"property_manager",
	"contractor",
	"other",
];
const STATUSES = ["active", "paused", "archived"];
const TIERS = ["bronze", "silver", "gold", "platinum"];

const TIER_COLORS: Record<string, string> = {
	bronze: "bg-amber-700/30 text-amber-400 border-amber-500/30",
	silver: "bg-slate-400/20 text-slate-300 border-slate-500/30",
	gold: "bg-amber-500/20 text-amber-300 border-amber-400/30",
	platinum: "bg-storm-purple/20 text-storm-glow border-storm-purple/30",
};

function formatCurrency(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(n);
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

	// Form state
	const [form, setForm] = useState({
		name: "",
		businessName: "",
		email: "",
		phone: "",
		partnerType: "other",
		territory: "",
		city: "",
		state: "",
		zip: "",
		tier: "bronze",
		notes: "",
	});
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

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
			try {
				await fetchPartners();
			} catch (e) {
				setError(e instanceof Error ? e.message : "Failed to load partners");
			} finally {
				setLoading(false);
			}
		})();
	}, [fetchPartners]);

	const handleCopy = async (referralCode: string, id: string) => {
		const url = `${typeof window !== "undefined" ? window.location.origin : ""}/ref/company/${referralCode}`;
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
					name: form.name,
					businessName: form.businessName || null,
					email: form.email || null,
					phone: form.phone || null,
					partnerType: form.partnerType,
					territory: form.territory || null,
					city: form.city || null,
					state: form.state || null,
					zip: form.zip || null,
					tier: form.tier,
					notes: form.notes || null,
				}),
			});
			const json = (await res.json()) as ApiEnvelope<Partner>;
			if (json.error) throw new Error(json.error);
			setForm({
				name: "",
				businessName: "",
				email: "",
				phone: "",
				partnerType: "other",
				territory: "",
				city: "",
				state: "",
				zip: "",
				tier: "bronze",
				notes: "",
			});
			setShowForm(false);
			void fetchPartners();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : "Failed to create partner");
		} finally {
			setSubmitting(false);
		}
	};

	const handleStatusToggle = async (partner: Partner) => {
		const next =
			partner.status === "active"
				? "paused"
				: partner.status === "paused"
					? "archived"
					: "active";
		try {
			const res = await fetch("/api/partner-engine/partners", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: partner.id, status: next }),
			});
			const json = (await res.json()) as ApiEnvelope<Partner>;
			if (json.error) throw new Error(json.error);
			void fetchPartners();
		} catch {
			// ignore
		}
	};

	if (loading && partners.length === 0) {
		return (
			<div className="flex min-h-[40vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-storm-purple" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-xl font-bold text-white">Partners</h1>
				<button
					type="button"
					onClick={() => setShowForm(!showForm)}
					className="inline-flex items-center gap-2 rounded-xl bg-storm-purple px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-storm-purple/90"
				>
					<Plus className="h-4 w-4" />
					Add Partner
				</button>
			</div>

			{/* Inline Add Form */}
			{showForm && (
				<form
					onSubmit={(e) => void handleSubmit(e)}
					className="rounded-2xl border border-storm-border bg-storm-z1 p-6"
				>
					<h3 className="text-sm font-semibold text-white">New Partner</h3>
					{formError && (
						<div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
							{formError}
						</div>
					)}
					<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<div>
							<label className="block text-xs font-medium text-storm-muted">Name *</label>
							<input
								required
								value={form.name}
								onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="John Smith"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">Business Name</label>
							<input
								value={form.businessName}
								onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="ABC Realty"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">Email</label>
							<input
								type="email"
								value={form.email}
								onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="john@example.com"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">Phone</label>
							<input
								value={form.phone}
								onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="(555) 123-4567"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">Partner Type</label>
							<select
								value={form.partnerType}
								onChange={(e) => setForm((f) => ({ ...f, partnerType: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
							>
								{PARTNER_TYPES.map((t) => (
									<option key={t} value={t}>
										{t.replace(/_/g, " ")}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">Territory</label>
							<input
								value={form.territory}
								onChange={(e) => setForm((f) => ({ ...f, territory: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="North Dallas"
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
							<label className="block text-xs font-medium text-storm-muted">Tier</label>
							<select
								value={form.tier}
								onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
							>
								{TIERS.map((t) => (
									<option key={t} value={t}>
										{t}
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
							{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Partner"}
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
				<div className="relative flex-1 min-w-[200px]">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-storm-subtle" />
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search partners..."
						className="w-full rounded-xl border border-storm-border bg-storm-z1 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
					/>
				</div>
				<select
					value={typeFilter}
					onChange={(e) => setTypeFilter(e.target.value)}
					className="rounded-xl border border-storm-border bg-storm-z1 px-4 py-2.5 text-sm text-white focus:border-storm-purple focus:outline-none"
				>
					<option value="">All types</option>
					{PARTNER_TYPES.map((t) => (
						<option key={t} value={t}>
							{t.replace(/_/g, " ")}
						</option>
					))}
				</select>
				<select
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-xl border border-storm-border bg-storm-z1 px-4 py-2.5 text-sm text-white focus:border-storm-purple focus:outline-none"
				>
					<option value="">All statuses</option>
					{STATUSES.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
				<select
					value={tierFilter}
					onChange={(e) => setTierFilter(e.target.value)}
					className="rounded-xl border border-storm-border bg-storm-z1 px-4 py-2.5 text-sm text-white focus:border-storm-purple focus:outline-none"
				>
					<option value="">All tiers</option>
					{TIERS.map((t) => (
						<option key={t} value={t}>
							{t}
						</option>
					))}
				</select>
			</div>

			{error && (
				<div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
					{error}
				</div>
			)}

			{/* Partners Table */}
			<div className="overflow-hidden rounded-2xl border border-storm-border bg-storm-z1">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-storm-border text-left text-storm-subtle">
								<th className="px-6 py-3 font-medium">Name / Business</th>
								<th className="px-6 py-3 font-medium">Type</th>
								<th className="px-6 py-3 font-medium">Tier</th>
								<th className="px-6 py-3 font-medium">Territory</th>
								<th className="px-6 py-3 font-medium">Status</th>
								<th className="px-6 py-3 font-medium">Referrals</th>
								<th className="px-6 py-3 font-medium">Revenue</th>
								<th className="px-6 py-3 font-medium">Referral Link</th>
								<th className="px-6 py-3 font-medium">Actions</th>
							</tr>
						</thead>
						<tbody>
							{partners.length === 0 ? (
								<tr>
									<td colSpan={9} className="px-6 py-12 text-center text-storm-muted">
										No partners found
									</td>
								</tr>
							) : (
								partners.map((p) => (
									<tr
										key={p.id}
										className="border-b border-storm-border/50 hover:bg-storm-z0/50"
									>
										<td className="px-6 py-3">
											<div className="font-medium text-white">{p.name}</div>
											{p.businessName && (
												<div className="text-xs text-storm-muted">{p.businessName}</div>
											)}
										</td>
										<td className="px-6 py-3 text-storm-muted capitalize">
											{p.partnerType.replace(/_/g, " ")}
										</td>
										<td className="px-6 py-3">
											<span
												className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${
													TIER_COLORS[p.tier] ?? TIER_COLORS.bronze
												}`}
											>
												{p.tier}
											</span>
										</td>
										<td className="px-6 py-3 text-storm-muted">{p.territory ?? "—"}</td>
										<td className="px-6 py-3">
											<Badge
												variant={
													p.status === "active"
														? "success"
														: p.status === "paused"
															? "warning"
															: "default"
												}
											>
												{p.status}
											</Badge>
										</td>
										<td className="px-6 py-3 text-white">{p.totalReferrals}</td>
										<td className="px-6 py-3 text-emerald-400">
											{formatCurrency(p.totalRevenue)}
										</td>
										<td className="px-6 py-3">
											<div className="flex items-center gap-1">
												<span className="max-w-[140px] truncate text-storm-muted text-xs">
													/ref/company/{p.referralCode}
												</span>
												<button
													type="button"
													onClick={() => void handleCopy(p.referralCode, p.id)}
													className="rounded p-1 text-storm-subtle hover:bg-storm-z2 hover:text-white"
													title="Copy link"
												>
													{copiedId === p.id ? (
														<Check className="h-3.5 w-3.5 text-emerald-400" />
													) : (
														<Copy className="h-3.5 w-3.5" />
													)}
												</button>
											</div>
										</td>
										<td className="px-6 py-3">
											<button
												type="button"
												onClick={() => void handleStatusToggle(p)}
												className="text-xs font-medium text-storm-glow hover:underline"
											>
												{p.status === "active"
													? "Pause"
													: p.status === "paused"
														? "Archive"
														: "Activate"}
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
