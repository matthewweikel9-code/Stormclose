"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, DollarSign, Award, Clock, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ApiEnvelope<T> = { data: T | null; error: string | null; meta: Record<string, unknown> };

interface Reward {
	id: string;
	partnerId: string | null;
	partnerName: string | null;
	referralId: string;
	referralAddress: string | null;
	amount: number;
	rewardType: string;
	status: string;
	paidAt: string | null;
	createdAt: string | null;
}

interface Referral { id: string; propertyAddress: string; }

const REWARD_TYPES = ["flat", "percentage"];

function formatCurrency(n: number) {
	return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function formatDate(s: string | null) {
	if (!s) return "—";
	return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SkeletonRows({ count = 4 }: { count?: number }) {
	return (
		<div className="space-y-3 p-4">
			{Array.from({ length: count }).map((_, i) => (
				<div key={i} className="flex items-center gap-3">
					<div className="skeleton h-9 w-9 rounded-xl" />
					<div className="flex-1 space-y-2">
						<div className="skeleton h-4 w-3/4 rounded" />
						<div className="skeleton h-2 w-1/2 rounded" />
					</div>
				</div>
			))}
		</div>
	);
}

export default function RewardsPage() {
	const [rewards, setRewards] = useState<Reward[]>([]);
	const [referrals, setReferrals] = useState<Referral[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);

	const [form, setForm] = useState({ referralId: "", amount: "", rewardType: "flat" as "flat" | "percentage" });
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const fetchRewards = useCallback(async () => {
		const res = await fetch("/api/partner-engine/rewards");
		const json = (await res.json()) as ApiEnvelope<Reward[]>;
		if (json.error) throw new Error(json.error);
		setRewards(json.data ?? []);
	}, []);

	const fetchReferrals = useCallback(async () => {
		const res = await fetch("/api/partner-engine/referrals");
		const json = (await res.json()) as ApiEnvelope<Array<{ id: string; propertyAddress: string }>>;
		if (json.error) return;
		setReferrals(json.data ?? []);
	}, []);

	useEffect(() => {
		void (async () => {
			setLoading(true);
			try { await Promise.all([fetchRewards(), fetchReferrals()]); } catch (e) { setError(e instanceof Error ? e.message : "Failed to load rewards"); } finally { setLoading(false); }
		})();
	}, [fetchRewards, fetchReferrals]);

	const pending = rewards.filter((r) => r.status === "pending");
	const approved = rewards.filter((r) => r.status === "approved");
	const paid = rewards.filter((r) => r.status === "paid");
	const totalPending = pending.reduce((s, r) => s + r.amount, 0);
	const totalApproved = approved.reduce((s, r) => s + r.amount, 0);
	const totalPaid = paid.reduce((s, r) => s + r.amount, 0);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const amount = parseFloat(form.amount);
		if (isNaN(amount) || amount < 0) { setFormError("Enter a valid amount"); return; }
		setSubmitting(true);
		setFormError(null);
		try {
			const res = await fetch("/api/partner-engine/rewards", {
				method: "POST", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ referralId: form.referralId, amount, rewardType: form.rewardType }),
			});
			const json = (await res.json()) as ApiEnvelope<Reward>;
			if (json.error) throw new Error(json.error);
			setForm({ referralId: "", amount: "", rewardType: "flat" });
			setShowForm(false);
			void fetchRewards();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : "Failed to create reward");
		} finally { setSubmitting(false); }
	};

	const handleApprove = async (id: string) => {
		try { const res = await fetch("/api/partner-engine/rewards", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "approved" }) }); const json = (await res.json()) as ApiEnvelope<Reward>; if (json.error) throw new Error(json.error); void fetchRewards(); } catch { /* ignore */ }
	};

	const handlePay = async (id: string) => {
		try { const res = await fetch("/api/partner-engine/rewards", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "paid" }) }); const json = (await res.json()) as ApiEnvelope<Reward>; if (json.error) throw new Error(json.error); void fetchRewards(); } catch { /* ignore */ }
	};

	const handleCancel = async (id: string) => {
		try { const res = await fetch("/api/partner-engine/rewards", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "cancelled" }) }); const json = (await res.json()) as ApiEnvelope<Reward>; if (json.error) throw new Error(json.error); void fetchRewards(); } catch { /* ignore */ }
	};

	if (loading && rewards.length === 0) {
		return (
			<div className="space-y-5 animate-fade-in">
				<div className="grid gap-4 md:grid-cols-3 stagger-children">
					{[1, 2, 3].map((i) => (
						<div key={i} className="storm-card p-5 space-y-3">
							<div className="skeleton h-10 w-10 rounded-xl" />
							<div className="skeleton h-7 w-24 rounded-lg" />
							<div className="skeleton h-3 w-16 rounded" />
						</div>
					))}
				</div>
				<div className="storm-card"><SkeletonRows count={5} /></div>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<Award className="h-5 w-5 text-storm-glow" />
					<h1 className="text-lg font-bold text-white">Rewards</h1>
					{rewards.length > 0 && <Badge variant="default">{rewards.length}</Badge>}
				</div>
				<button type="button" onClick={() => setShowForm(!showForm)} className="button-primary flex items-center gap-2 text-sm">
					<Plus className="h-4 w-4" />
					Create Reward
				</button>
			</div>

			{/* Summary KPIs */}
			<section className="grid gap-4 md:grid-cols-3 stagger-children">
				<div className="storm-card-glow relative overflow-hidden border border-amber-500/20 p-5">
					<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
					<div className="rounded-xl p-2 bg-amber-500/15 w-fit mb-2">
						<Clock className="h-5 w-5 text-amber-400" />
					</div>
					<p className="text-2xl font-bold text-amber-400 tabular-nums">{formatCurrency(totalPending)}</p>
					<p className="mt-0.5 text-xs text-storm-subtle">
						{pending.length} pending reward{pending.length !== 1 ? "s" : ""}
					</p>
				</div>
				<div className="storm-card-glow relative overflow-hidden border border-storm-purple/20 p-5">
					<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-storm-purple/30 to-transparent" />
					<div className="rounded-xl p-2 bg-storm-purple/15 w-fit mb-2">
						<CheckCircle className="h-5 w-5 text-storm-glow" />
					</div>
					<p className="text-2xl font-bold text-storm-glow tabular-nums">{formatCurrency(totalApproved)}</p>
					<p className="mt-0.5 text-xs text-storm-subtle">
						{approved.length} approved reward{approved.length !== 1 ? "s" : ""}
					</p>
				</div>
				<div className="storm-card-glow relative overflow-hidden border border-emerald-500/20 p-5">
					<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
					<div className="rounded-xl p-2 bg-emerald-500/15 w-fit mb-2">
						<DollarSign className="h-5 w-5 text-emerald-400" />
					</div>
					<p className="text-2xl font-bold text-emerald-400 tabular-nums">{formatCurrency(totalPaid)}</p>
					<p className="mt-0.5 text-xs text-storm-subtle">
						{paid.length} paid reward{paid.length !== 1 ? "s" : ""}
					</p>
				</div>
			</section>

			{showForm && (
				<form onSubmit={(e) => void handleSubmit(e)} className="storm-card p-5">
					<h3 className="text-sm font-semibold text-white mb-3">Create Reward</h3>
					{formError && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{formError}</div>}
					<div className="grid gap-3 sm:grid-cols-3">
						<div className="sm:col-span-2">
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Referral</label>
							<select required value={form.referralId} onChange={(e) => setForm((f) => ({ ...f, referralId: e.target.value }))} className="dashboard-select">
								<option value="">— Select referral —</option>
								{referrals.map((r) => <option key={r.id} value={r.id}>{r.propertyAddress}</option>)}
							</select>
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Amount</label>
							<input required type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="dashboard-input" placeholder="250" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Reward Type</label>
							<select value={form.rewardType} onChange={(e) => setForm((f) => ({ ...f, rewardType: e.target.value as "flat" | "percentage" }))} className="dashboard-select">
								{REWARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
							</select>
						</div>
					</div>
					<div className="mt-4 flex gap-2">
						<button type="submit" disabled={submitting} className="button-primary text-sm">
							{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
						</button>
						<button type="button" onClick={() => setShowForm(false)} className="button-secondary text-sm">Cancel</button>
					</div>
				</form>
			)}

			{error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">{error}</div>}

			{/* Rewards List */}
			<div className="storm-card overflow-hidden">
				<div className="glow-line" />
				{rewards.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16">
						<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-storm-z2 mb-3">
							<Award className="h-7 w-7 text-storm-subtle" />
						</div>
						<p className="text-sm font-medium text-white">No rewards yet</p>
						<p className="text-xs text-storm-subtle mt-1">Create a reward for a completed referral</p>
					</div>
				) : (
					<div className="stagger-children">
						{rewards.map((r) => (
							<div key={r.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-storm-z2/30 transition-colors border-b border-storm-border/20 last:border-b-0">
								<div className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 ${
									r.status === "paid" ? "bg-emerald-500/15" :
									r.status === "approved" ? "bg-storm-purple/15" :
									r.status === "cancelled" ? "bg-red-500/15" : "bg-amber-500/15"
								}`}>
									<DollarSign className={`h-4 w-4 ${
										r.status === "paid" ? "text-emerald-400" :
										r.status === "approved" ? "text-storm-glow" :
										r.status === "cancelled" ? "text-red-400" : "text-amber-400"
									}`} />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="text-sm font-medium text-white truncate">{r.referralAddress ?? "Unknown"}</span>
										<Badge variant={r.status === "paid" ? "success" : r.status === "approved" ? "purple" : r.status === "cancelled" ? "danger" : "warning"}>
											{r.status}
										</Badge>
									</div>
									<p className="text-2xs text-storm-subtle mt-0.5">
										{r.partnerName ?? "Unknown partner"} · {r.rewardType} · {formatDate(r.createdAt)}
									</p>
								</div>
								<div className="text-right flex-shrink-0">
									<p className="text-sm font-bold text-emerald-400 tabular-nums">{formatCurrency(r.amount)}</p>
									{r.paidAt && <p className="text-2xs text-storm-subtle">Paid {formatDate(r.paidAt)}</p>}
								</div>
								<div className="flex items-center gap-1.5 flex-shrink-0">
									{r.status === "pending" && (
										<>
											<button type="button" onClick={() => void handleApprove(r.id)} className="button-secondary text-2xs px-2 py-1 flex items-center gap-1">
												<CheckCircle className="h-3 w-3" /> Approve
											</button>
											<button type="button" onClick={() => void handleCancel(r.id)} className="rounded-lg px-2 py-1 text-2xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1">
												<XCircle className="h-3 w-3" /> Cancel
											</button>
										</>
									)}
									{r.status === "approved" && (
										<>
											<button type="button" onClick={() => void handlePay(r.id)} className="button-primary text-2xs px-2 py-1 flex items-center gap-1">
												<DollarSign className="h-3 w-3" /> Pay
											</button>
											<button type="button" onClick={() => void handleCancel(r.id)} className="rounded-lg px-2 py-1 text-2xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1">
												<XCircle className="h-3 w-3" /> Cancel
											</button>
										</>
									)}
									{(r.status === "paid" || r.status === "cancelled") && (
										<span className="text-2xs text-storm-subtle px-2">—</span>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
