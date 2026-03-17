"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, DollarSign } from "lucide-react";
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

interface Referral {
	id: string;
	propertyAddress: string;
}

const REWARD_TYPES = ["flat", "percentage"];

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

export default function RewardsPage() {
	const [rewards, setRewards] = useState<Reward[]>([]);
	const [referrals, setReferrals] = useState<Referral[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);

	// Form state
	const [form, setForm] = useState({
		referralId: "",
		amount: "",
		rewardType: "flat" as "flat" | "percentage",
	});
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
			try {
				await Promise.all([fetchRewards(), fetchReferrals()]);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Failed to load rewards");
			} finally {
				setLoading(false);
			}
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
		if (isNaN(amount) || amount < 0) {
			setFormError("Enter a valid amount");
			return;
		}
		setSubmitting(true);
		setFormError(null);
		try {
			const res = await fetch("/api/partner-engine/rewards", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					referralId: form.referralId,
					amount,
					rewardType: form.rewardType,
				}),
			});
			const json = (await res.json()) as ApiEnvelope<Reward>;
			if (json.error) throw new Error(json.error);
			setForm({ referralId: "", amount: "", rewardType: "flat" });
			setShowForm(false);
			void fetchRewards();
		} catch (e) {
			setFormError(e instanceof Error ? e.message : "Failed to create reward");
		} finally {
			setSubmitting(false);
		}
	};

	const handleApprove = async (id: string) => {
		try {
			const res = await fetch("/api/partner-engine/rewards", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, status: "approved" }),
			});
			const json = (await res.json()) as ApiEnvelope<Reward>;
			if (json.error) throw new Error(json.error);
			void fetchRewards();
		} catch {
			// ignore
		}
	};

	const handlePay = async (id: string) => {
		try {
			const res = await fetch("/api/partner-engine/rewards", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, status: "paid" }),
			});
			const json = (await res.json()) as ApiEnvelope<Reward>;
			if (json.error) throw new Error(json.error);
			void fetchRewards();
		} catch {
			// ignore
		}
	};

	const handleCancel = async (id: string) => {
		try {
			const res = await fetch("/api/partner-engine/rewards", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, status: "cancelled" }),
			});
			const json = (await res.json()) as ApiEnvelope<Reward>;
			if (json.error) throw new Error(json.error);
			void fetchRewards();
		} catch {
			// ignore
		}
	};

	if (loading && rewards.length === 0) {
		return (
			<div className="flex min-h-[40vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-storm-purple" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-xl font-bold text-white">Rewards</h1>
				<button
					type="button"
					onClick={() => setShowForm(!showForm)}
					className="inline-flex items-center gap-2 rounded-xl bg-storm-purple px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-storm-purple/90"
				>
					<Plus className="h-4 w-4" />
					Create Reward
				</button>
			</div>

			{/* Summary Cards */}
			<section className="grid gap-4 md:grid-cols-3">
				<div className="rounded-2xl border border-storm-border bg-storm-z1 p-6">
					<div className="flex items-center gap-2 text-storm-muted">
						<DollarSign className="h-5 w-5" />
						<span className="text-sm font-medium">Total Pending</span>
					</div>
					<p className="mt-2 text-2xl font-bold text-amber-400">
						{formatCurrency(totalPending)}
					</p>
					<p className="mt-0.5 text-xs text-storm-subtle">
						{pending.length} reward{pending.length !== 1 ? "s" : ""}
					</p>
				</div>
				<div className="rounded-2xl border border-storm-border bg-storm-z1 p-6">
					<div className="flex items-center gap-2 text-storm-muted">
						<DollarSign className="h-5 w-5" />
						<span className="text-sm font-medium">Total Approved</span>
					</div>
					<p className="mt-2 text-2xl font-bold text-storm-glow">
						{formatCurrency(totalApproved)}
					</p>
					<p className="mt-0.5 text-xs text-storm-subtle">
						{approved.length} reward{approved.length !== 1 ? "s" : ""}
					</p>
				</div>
				<div className="rounded-2xl border border-storm-border bg-storm-z1 p-6">
					<div className="flex items-center gap-2 text-storm-muted">
						<DollarSign className="h-5 w-5" />
						<span className="text-sm font-medium">Total Paid</span>
					</div>
					<p className="mt-2 text-2xl font-bold text-emerald-400">
						{formatCurrency(totalPaid)}
					</p>
					<p className="mt-0.5 text-xs text-storm-subtle">
						{paid.length} reward{paid.length !== 1 ? "s" : ""}
					</p>
				</div>
			</section>

			{/* Create Reward Form */}
			{showForm && (
				<form
					onSubmit={(e) => void handleSubmit(e)}
					className="rounded-2xl border border-storm-border bg-storm-z1 p-6"
				>
					<h3 className="text-sm font-semibold text-white">Create Reward</h3>
					{formError && (
						<div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
							{formError}
						</div>
					)}
					<div className="mt-4 grid gap-4 sm:grid-cols-3">
						<div className="sm:col-span-2">
							<label className="block text-xs font-medium text-storm-muted">
								Referral
							</label>
							<select
								required
								value={form.referralId}
								onChange={(e) =>
									setForm((f) => ({ ...f, referralId: e.target.value }))
								}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
							>
								<option value="">— Select referral —</option>
								{referrals.map((r) => (
									<option key={r.id} value={r.id}>
										{r.propertyAddress}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">
								Amount
							</label>
							<input
								required
								type="number"
								min="0"
								step="0.01"
								value={form.amount}
								onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white placeholder:text-storm-subtle focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="250"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium text-storm-muted">
								Reward Type
							</label>
							<select
								value={form.rewardType}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										rewardType: e.target.value as "flat" | "percentage",
									}))
								}
								className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
							>
								{REWARD_TYPES.map((t) => (
									<option key={t} value={t}>
										{t}
									</option>
								))}
							</select>
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
								"Create"
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

			{error && (
				<div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
					{error}
				</div>
			)}

			{/* Rewards Table */}
			<div className="overflow-hidden rounded-2xl border border-storm-border bg-storm-z1">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-storm-border text-left text-storm-subtle">
								<th className="px-6 py-3 font-medium">Referral Address</th>
								<th className="px-6 py-3 font-medium">Partner</th>
								<th className="px-6 py-3 font-medium">Amount</th>
								<th className="px-6 py-3 font-medium">Type</th>
								<th className="px-6 py-3 font-medium">Status</th>
								<th className="px-6 py-3 font-medium">Paid Date</th>
								<th className="px-6 py-3 font-medium">Actions</th>
							</tr>
						</thead>
						<tbody>
							{rewards.length === 0 ? (
								<tr>
									<td colSpan={7} className="px-6 py-12 text-center text-storm-muted">
										No rewards yet
									</td>
								</tr>
							) : (
								rewards.map((r) => (
									<tr
										key={r.id}
										className="border-b border-storm-border/50 hover:bg-storm-z0/50"
									>
										<td className="px-6 py-3 text-white">
											{r.referralAddress ?? "—"}
										</td>
										<td className="px-6 py-3 text-storm-muted">
											{r.partnerName ?? "—"}
										</td>
										<td className="px-6 py-3 text-emerald-400">
											{formatCurrency(r.amount)}
										</td>
										<td className="px-6 py-3 text-storm-muted">{r.rewardType}</td>
										<td className="px-6 py-3">
											<Badge
												variant={
													r.status === "paid"
														? "success"
														: r.status === "approved"
															? "purple"
															: r.status === "cancelled"
																? "danger"
																: "warning"
												}
											>
												{r.status}
											</Badge>
										</td>
										<td className="px-6 py-3 text-storm-muted">
											{formatDate(r.paidAt)}
										</td>
										<td className="px-6 py-3">
											<div className="flex gap-2">
												{r.status === "pending" && (
													<>
														<button
															type="button"
															onClick={() => void handleApprove(r.id)}
															className="text-xs font-medium text-storm-glow hover:underline"
														>
															Approve
														</button>
														<button
															type="button"
															onClick={() => void handleCancel(r.id)}
															className="text-xs font-medium text-red-400 hover:underline"
														>
															Cancel
														</button>
													</>
												)}
												{r.status === "approved" && (
													<>
														<button
															type="button"
															onClick={() => void handlePay(r.id)}
															className="text-xs font-medium text-emerald-400 hover:underline"
														>
															Pay
														</button>
														<button
															type="button"
															onClick={() => void handleCancel(r.id)}
															className="text-xs font-medium text-red-400 hover:underline"
														>
															Cancel
														</button>
													</>
												)}
												{r.status === "paid" && (
													<span className="text-xs text-storm-muted">—</span>
												)}
												{r.status === "cancelled" && (
													<span className="text-xs text-storm-muted">—</span>
												)}
											</div>
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
