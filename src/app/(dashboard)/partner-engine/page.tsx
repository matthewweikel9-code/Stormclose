"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
	Users,
	ArrowRight,
	DollarSign,
	TrendingUp,
	Award,
	Clock,
	CheckCircle,
	Search,
	Plus,
	ExternalLink,
	Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ApiEnvelope<T> = { data: T | null; error: string | null; meta: Record<string, unknown> };

interface DashboardData {
	partnersCount: number;
	referralsCount: number;
	installedCount: number;
	closedCount: number;
	lostCount: number;
	totalRevenue: number;
	totalRewardsPaid: number;
	averageContractValue: number;
	conversionRate: number;
	referralVelocity: number;
	pipelineByStatus: Array<{ status: string; count: number }>;
	topPartners: Array<{
		partnerId: string;
		name: string;
		type: string;
		tier: string;
		referrals: number;
		installed: number;
		revenue: number;
		rewardsPaid: number;
	}>;
	recentReferrals: Array<{
		id: string;
		partnerName: string | null;
		propertyAddress: string;
		status: string;
		contractValue: number;
		createdAt: string | null;
	}>;
}

const STATUS_COLORS: Record<string, string> = {
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

export default function PartnerEngineDashboardPage() {
	const [data, setData] = useState<DashboardData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void (async () => {
			try {
				const res = await fetch("/api/partner-engine/dashboard");
				const json = (await res.json()) as ApiEnvelope<DashboardData>;
				if (json.error) throw new Error(json.error);
				setData(json.data ?? null);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Failed to load dashboard");
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	if (loading) {
		return (
			<div className="flex min-h-[40vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-storm-purple" />
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
				{error ?? "Failed to load dashboard"}
			</div>
		);
	}

	const totalPipeline = data.pipelineByStatus.reduce((s, p) => s + p.count, 0);

	return (
		<div className="space-y-8">
			{/* Hero */}
			<section className="rounded-2xl border border-storm-border bg-storm-z1 p-6">
				<h1 className="text-2xl font-bold text-white md:text-3xl">Referral Engine</h1>
				<p className="mt-1 text-storm-muted">
					Manage partners, track referrals, and grow revenue through your network.
				</p>
				<div className="mt-6 flex flex-wrap gap-3">
					<Link
						href="/partner-engine/partners"
						className="inline-flex items-center gap-2 rounded-xl bg-storm-purple px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-storm-purple/90"
					>
						<Plus className="h-4 w-4" />
						Add Partner
					</Link>
					<Link
						href="/partner-engine/referrals"
						className="inline-flex items-center gap-2 rounded-xl border border-storm-border bg-storm-z0 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-storm-z2"
					>
						<Search className="h-4 w-4" />
						Work Referrals
					</Link>
					<a
						href="/settings/integrations"
						className="inline-flex items-center gap-2 rounded-xl border border-storm-border bg-storm-z0 px-4 py-2.5 text-sm font-medium text-storm-muted transition-colors hover:bg-storm-z2 hover:text-white"
					>
						<ExternalLink className="h-4 w-4" />
						Connect JobNimbus
					</a>
				</div>
			</section>

			{/* KPI Grid */}
			<section className="grid grid-cols-2 gap-4 md:grid-cols-5">
				<KpiCard
					icon={<Users className="h-5 w-5 text-storm-glow" />}
					value={data.partnersCount}
					label="Partners"
				/>
				<KpiCard
					icon={<ArrowRight className="h-5 w-5 text-storm-glow" />}
					value={data.referralsCount}
					label="Referrals"
				/>
				<KpiCard
					icon={<CheckCircle className="h-5 w-5 text-emerald-400" />}
					value={data.installedCount}
					label="Roofs Installed"
				/>
				<KpiCard
					icon={<DollarSign className="h-5 w-5 text-emerald-400" />}
					value={formatCurrency(data.totalRevenue)}
					label="Revenue Attributed"
				/>
				<KpiCard
					icon={<Award className="h-5 w-5 text-storm-glow" />}
					value={formatCurrency(data.totalRewardsPaid)}
					label="Rewards Paid"
				/>
			</section>

			{/* Conversion & Velocity */}
			<section className="grid gap-6 md:grid-cols-2">
				<div className="rounded-2xl border border-storm-border bg-storm-z1 p-6">
					<h3 className="text-sm font-semibold uppercase tracking-wider text-storm-muted">
						Conversion Rate
					</h3>
					<p className="mt-2 text-3xl font-bold text-white">
						{data.conversionRate.toFixed(1)}%
					</p>
					<p className="mt-1 text-sm text-storm-subtle">
						Referrals → Roofs installed
					</p>
				</div>
				<div className="rounded-2xl border border-storm-border bg-storm-z1 p-6">
					<h3 className="text-sm font-semibold uppercase tracking-wider text-storm-muted">
						Referral Velocity
					</h3>
					<p className="mt-2 text-3xl font-bold text-white">
						{data.referralVelocity.toFixed(1)}
					</p>
					<p className="mt-1 text-sm text-storm-subtle">
						Avg days to install
					</p>
				</div>
			</section>

			{/* Pipeline Summary */}
			<section className="rounded-2xl border border-storm-border bg-storm-z1 p-6">
				<h3 className="text-sm font-semibold uppercase tracking-wider text-storm-muted">
					Pipeline Summary
				</h3>
				<div className="mt-4 flex h-10 w-full gap-0.5 overflow-hidden rounded-xl bg-storm-z0">
					{data.pipelineByStatus.map(({ status, count }) => {
						const pct = totalPipeline > 0 ? (count / totalPipeline) * 100 : 0;
						return (
							<div
								key={status}
								title={`${statusLabel(status)}: ${count}`}
								className={`${STATUS_COLORS[status] ?? "bg-storm-subtle"} transition-all`}
								style={{ width: `${Math.max(pct, 2)}%` }}
							/>
						);
					})}
				</div>
				<div className="mt-3 flex flex-wrap gap-4 text-xs">
					{data.pipelineByStatus.map(({ status, count }) => (
						<span key={status} className="flex items-center gap-1.5 text-storm-muted">
							<span
								className={`h-2 w-2 rounded-full ${STATUS_COLORS[status] ?? "bg-storm-subtle"}`}
							/>
							{statusLabel(status)}: {count}
						</span>
					))}
				</div>
			</section>

			{/* Top Partners & Recent Referrals */}
			<div className="grid gap-8 lg:grid-cols-2">
				{/* Top Partners */}
				<section className="rounded-2xl border border-storm-border bg-storm-z1 overflow-hidden">
					<div className="border-b border-storm-border px-6 py-4">
						<h3 className="text-sm font-semibold uppercase tracking-wider text-storm-muted">
							Top Partners
						</h3>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-storm-border text-left text-storm-subtle">
									<th className="px-6 py-3 font-medium">#</th>
									<th className="px-6 py-3 font-medium">Name</th>
									<th className="px-6 py-3 font-medium">Type</th>
									<th className="px-6 py-3 font-medium">Tier</th>
									<th className="px-6 py-3 font-medium">Referrals</th>
									<th className="px-6 py-3 font-medium">Installs</th>
									<th className="px-6 py-3 font-medium">Revenue</th>
									<th className="px-6 py-3 font-medium">Rewards</th>
								</tr>
							</thead>
							<tbody>
								{data.topPartners.length === 0 ? (
									<tr>
										<td colSpan={8} className="px-6 py-8 text-center text-storm-muted">
											No partners yet
										</td>
									</tr>
								) : (
									data.topPartners.map((p, i) => (
										<tr
											key={p.partnerId}
											className="border-b border-storm-border/50 hover:bg-storm-z0/50"
										>
											<td className="px-6 py-3 text-storm-muted">{i + 1}</td>
											<td className="px-6 py-3 font-medium text-white">{p.name}</td>
											<td className="px-6 py-3 text-storm-muted capitalize">
												{p.type.replace(/_/g, " ")}
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
											<td className="px-6 py-3 text-white">{p.referrals}</td>
											<td className="px-6 py-3 text-white">{p.installed}</td>
											<td className="px-6 py-3 text-emerald-400">
												{formatCurrency(p.revenue)}
											</td>
											<td className="px-6 py-3 text-storm-muted">
												{formatCurrency(p.rewardsPaid)}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</section>

				{/* Recent Referrals */}
				<section className="rounded-2xl border border-storm-border bg-storm-z1 overflow-hidden">
					<div className="flex items-center justify-between border-b border-storm-border px-6 py-4">
						<h3 className="text-sm font-semibold uppercase tracking-wider text-storm-muted">
							Recent Referrals
						</h3>
						<Link
							href="/partner-engine/referrals"
							className="text-xs font-medium text-storm-glow hover:underline"
						>
							View all
						</Link>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-storm-border text-left text-storm-subtle">
									<th className="px-6 py-3 font-medium">Partner</th>
									<th className="px-6 py-3 font-medium">Address</th>
									<th className="px-6 py-3 font-medium">Status</th>
									<th className="px-6 py-3 font-medium">Date</th>
									<th className="px-6 py-3 font-medium">Value</th>
								</tr>
							</thead>
							<tbody>
								{data.recentReferrals.length === 0 ? (
									<tr>
										<td colSpan={5} className="px-6 py-8 text-center text-storm-muted">
											No referrals yet
										</td>
									</tr>
								) : (
									data.recentReferrals.map((r) => (
										<tr
											key={r.id}
											className="border-b border-storm-border/50 hover:bg-storm-z0/50"
										>
											<td className="px-6 py-3 text-storm-muted">
												{r.partnerName ?? "—"}
											</td>
											<td className="px-6 py-3 text-white">{r.propertyAddress}</td>
											<td className="px-6 py-3">
												<Badge
													variant={
														r.status === "roof_installed" || r.status === "closed"
															? "success"
															: r.status === "lost"
																? "danger"
																: "default"
													}
												>
													{statusLabel(r.status)}
												</Badge>
											</td>
											<td className="px-6 py-3 text-storm-muted">
												{formatDate(r.createdAt)}
											</td>
											<td className="px-6 py-3 text-emerald-400">
												{formatCurrency(r.contractValue)}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</section>
			</div>
		</div>
	);
}

function KpiCard({
	icon,
	value,
	label,
}: {
	icon: React.ReactNode;
	value: string | number;
	label: string;
}) {
	return (
		<div className="rounded-2xl border border-storm-border bg-storm-z1 p-4">
			<div className="flex items-center gap-2 text-storm-muted">{icon}</div>
			<p className="mt-2 text-xl font-bold text-white md:text-2xl">{value}</p>
			<p className="mt-0.5 text-xs text-storm-subtle">{label}</p>
		</div>
	);
}
