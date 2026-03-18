"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
	Users,
	ArrowRight,
	DollarSign,
	TrendingUp,
	Award,
	CheckCircle,
	Plus,
	Search,
	ExternalLink,
	Loader2,
	Handshake,
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

const TIER_BADGE: Record<string, "warning" | "default" | "purple" | "info"> = {
	bronze: "default",
	silver: "info",
	gold: "warning",
	platinum: "purple",
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

function SkeletonRows({ count = 3 }: { count?: number }) {
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

function RankMedal({ rank }: { rank: number }) {
	if (rank === 0) return <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/30 to-orange-500/20 text-amber-400 text-xs font-bold border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.25)]">1</span>;
	if (rank === 1) return <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-300/20 to-slate-400/10 text-slate-300 text-xs font-bold border border-slate-400/20">2</span>;
	if (rank === 2) return <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-700/25 to-orange-800/15 text-amber-600 text-xs font-bold border border-amber-700/25">3</span>;
	return <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-storm-z2 text-storm-subtle text-xs font-bold border border-storm-border/50">{rank + 1}</span>;
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
			<div className="space-y-6 animate-fade-in">
				<div className="storm-card p-6 space-y-3">
					<div className="skeleton h-8 w-48 rounded-lg" />
					<div className="skeleton h-4 w-80 rounded" />
				</div>
				<div className="grid grid-cols-2 md:grid-cols-5 gap-4 stagger-children">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="storm-card p-5 space-y-3">
							<div className="skeleton h-10 w-10 rounded-xl" />
							<div className="skeleton h-7 w-20 rounded-lg" />
							<div className="skeleton h-3 w-16 rounded" />
						</div>
					))}
				</div>
				<div className="grid gap-6 lg:grid-cols-2">
					<div className="storm-card"><SkeletonRows count={5} /></div>
					<div className="storm-card"><SkeletonRows count={5} /></div>
				</div>
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
		<div className="space-y-6">
			{/* Hero */}
			<section className="storm-card-glow overflow-hidden border-storm-purple/20">
				<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-storm-purple/40 to-transparent" />
				<div className="p-6">
					<div className="flex items-center gap-4 mb-4">
						<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-storm-purple/20 to-storm-glow/10 shadow-glow-sm">
							<Handshake className="h-6 w-6 text-storm-glow" />
						</div>
						<div>
							<h1 className="text-2xl font-bold text-white tracking-tight">Referral Engine</h1>
							<p className="text-sm text-storm-muted">Manage partners, track referrals, and grow revenue through your network.</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-3">
						<Link href="/partner-engine/partners" className="button-primary flex items-center gap-2 text-sm">
							<Plus className="h-4 w-4" />
							Add Partner
						</Link>
						<Link href="/partner-engine/referrals" className="button-secondary flex items-center gap-2 text-sm">
							<Search className="h-4 w-4" />
							Work Referrals
						</Link>
						<a href="/settings/integrations" className="button-secondary flex items-center gap-2 text-sm text-storm-muted">
							<ExternalLink className="h-4 w-4" />
							Connect JobNimbus
						</a>
					</div>
				</div>
			</section>

			{/* KPI Grid */}
			<section className="grid grid-cols-2 gap-4 md:grid-cols-5 stagger-children">
				<KpiCard icon={<Users className="h-5 w-5" />} iconBg="bg-storm-purple/15" iconColor="text-storm-glow" accentBorder="border-storm-purple/20" value={data.partnersCount} label="Partners" />
				<KpiCard icon={<ArrowRight className="h-5 w-5" />} iconBg="bg-blue-500/15" iconColor="text-blue-400" accentBorder="border-blue-500/20" value={data.referralsCount} label="Referrals" />
				<KpiCard icon={<CheckCircle className="h-5 w-5" />} iconBg="bg-emerald-500/15" iconColor="text-emerald-400" accentBorder="border-emerald-500/20" value={data.installedCount} label="Roofs Installed" />
				<KpiCard icon={<DollarSign className="h-5 w-5" />} iconBg="bg-amber-500/15" iconColor="text-amber-400" accentBorder="border-amber-500/20" value={formatCurrency(data.totalRevenue)} label="Revenue Attributed" />
				<KpiCard icon={<Award className="h-5 w-5" />} iconBg="bg-storm-purple/15" iconColor="text-storm-glow" accentBorder="border-storm-purple/20" value={formatCurrency(data.totalRewardsPaid)} label="Rewards Paid" />
			</section>

			{/* Conversion & Velocity */}
			<section className="grid gap-4 md:grid-cols-2">
				<div className="glass rounded-2xl p-5">
					<h3 className="text-2xs uppercase tracking-wider text-storm-subtle font-medium">Conversion Rate</h3>
					<p className="mt-2 text-3xl font-bold text-gradient-purple tabular-nums">{data.conversionRate.toFixed(1)}%</p>
					<p className="mt-1 text-xs text-storm-subtle">Referrals → Roofs installed</p>
				</div>
				<div className="glass rounded-2xl p-5">
					<h3 className="text-2xs uppercase tracking-wider text-storm-subtle font-medium">Referral Velocity</h3>
					<p className="mt-2 text-3xl font-bold text-gradient-purple tabular-nums">{data.referralVelocity.toFixed(1)}</p>
					<p className="mt-1 text-xs text-storm-subtle">Avg days to install</p>
				</div>
			</section>

			{/* Pipeline Summary */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5">
					<div className="flex items-center gap-2 mb-4">
						<TrendingUp className="h-4 w-4 text-storm-glow" />
						<h3 className="text-sm font-semibold text-white">Pipeline Summary</h3>
						<Badge variant="default">{totalPipeline} total</Badge>
					</div>
					<div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-storm-z0">
						{data.pipelineByStatus.map(({ status, count }) => {
							const pct = totalPipeline > 0 ? (count / totalPipeline) * 100 : 0;
							return (
								<div
									key={status}
									title={`${statusLabel(status)}: ${count}`}
									className={`${STATUS_COLORS[status] ?? "bg-storm-subtle"} transition-all duration-500`}
									style={{ width: `${Math.max(pct, 2)}%` }}
								/>
							);
						})}
					</div>
					<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
						{data.pipelineByStatus.map(({ status, count }) => (
							<span key={status} className="flex items-center gap-1.5 text-xs text-storm-muted">
								<span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status] ?? "bg-storm-subtle"}`} />
								{statusLabel(status)}: {count}
							</span>
						))}
					</div>
				</div>
			</section>

			{/* Top Partners & Recent Referrals */}
			<div className="grid gap-5 lg:grid-cols-2">
				{/* Top Partners */}
				<div className="storm-card overflow-hidden">
					<div className="glow-line" />
					<div className="flex items-center justify-between p-4 pb-3">
						<div className="flex items-center gap-2">
							<Users className="h-4 w-4 text-storm-glow" />
							<h3 className="text-sm font-semibold text-white">Top Partners</h3>
						</div>
						<Link href="/partner-engine/partners" className="text-2xs font-medium text-storm-glow hover:text-storm-purple transition-colors">
							View all
						</Link>
					</div>
					{data.topPartners.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 px-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-storm-z2 mb-3">
								<Users className="h-6 w-6 text-storm-subtle" />
							</div>
							<p className="text-sm font-medium text-white">No partners yet</p>
							<p className="text-xs text-storm-subtle mt-1">Add partners to see them ranked here</p>
						</div>
					) : (
						<div className="space-y-0 px-4 pb-4 stagger-children">
							{data.topPartners.map((p, i) => (
								<div key={p.partnerId} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-storm-z2/50 transition-colors">
									<RankMedal rank={i} />
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium text-white truncate">{p.name}</span>
											<Badge variant={TIER_BADGE[p.tier] ?? "default"}>{p.tier}</Badge>
										</div>
										<span className="text-2xs text-storm-subtle capitalize">{p.type.replace(/_/g, " ")} · {p.referrals} referrals</span>
									</div>
									<div className="text-right flex-shrink-0">
										<p className="text-sm font-bold text-emerald-400 tabular-nums">{formatCurrency(p.revenue)}</p>
										<p className="text-2xs text-storm-subtle">{p.installed} installs</p>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Recent Referrals */}
				<div className="storm-card overflow-hidden">
					<div className="glow-line" />
					<div className="flex items-center justify-between p-4 pb-3">
						<div className="flex items-center gap-2">
							<ArrowRight className="h-4 w-4 text-storm-glow" />
							<h3 className="text-sm font-semibold text-white">Recent Referrals</h3>
						</div>
						<Link href="/partner-engine/referrals" className="text-2xs font-medium text-storm-glow hover:text-storm-purple transition-colors">
							View all
						</Link>
					</div>
					{data.recentReferrals.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 px-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-storm-z2 mb-3">
								<ArrowRight className="h-6 w-6 text-storm-subtle" />
							</div>
							<p className="text-sm font-medium text-white">No referrals yet</p>
							<p className="text-xs text-storm-subtle mt-1">Referrals from partners will appear here</p>
						</div>
					) : (
						<div className="stagger-children">
							{data.recentReferrals.map((r) => (
								<div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-storm-z2/30 transition-colors border-l-2 border-transparent hover:border-storm-purple/30">
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-white truncate">{r.propertyAddress}</p>
										<p className="text-2xs text-storm-subtle">{r.partnerName ?? "Direct"} · {formatDate(r.createdAt)}</p>
									</div>
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
									<span className="text-sm font-medium text-emerald-400 tabular-nums flex-shrink-0">{formatCurrency(r.contractValue)}</span>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function KpiCard({ icon, iconBg, iconColor, accentBorder, value, label }: {
	icon: React.ReactNode; iconBg: string; iconColor: string; accentBorder: string; value: string | number; label: string;
}) {
	return (
		<div className={`storm-card-glow relative overflow-hidden border ${accentBorder} p-5`}>
			<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-storm-purple/30 to-transparent" />
			<div className={`rounded-xl p-2 ${iconBg} w-fit mb-2`}>
				<span className={iconColor}>{icon}</span>
			</div>
			<p className="text-2xl font-bold text-white tabular-nums animate-count-up">{value}</p>
			<p className="mt-0.5 text-xs uppercase tracking-wider text-storm-subtle font-medium">{label}</p>
		</div>
	);
}
