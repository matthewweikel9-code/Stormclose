"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
	Monitor,
	Home,
	Crosshair,
	Users,
	Upload,
	Trophy,
	DollarSign,
	Target,
	Zap,
	CloudLightning,
	Handshake,
	TrendingUp,
	Maximize2,
	Minimize2,
	FileText,
	Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type MissionControlData = {
	kpi: {
		housesToHit: number;
		activeMissions: number;
		repsInField: number;
		exportsToday: number;
	};
	team: {
		totalDoors: number;
		totalAppointments: number;
		totalLeads: number;
		totalClosed: number;
		totalRevenue: number;
		members: Array<{ id: string; name: string; revenue: number; doorsKnocked: number }>;
		topPerformer: string;
	};
	exportQueue: {
		readyCount: number;
		exportedTodayCount: number;
		failedCount: number;
		successRatePercent: number;
	};
	opportunities?: {
		totalValue: number;
		activeZones: number;
		hotLeads: number;
		stormZones: Array<{ id: string; location: string; opportunityScore: number }>;
	};
	referralEngine?: {
		partnersCount: number;
		referralsCount: number;
		closedCount: number;
		totalRevenue: number;
	};
};

const POLL_INTERVAL_MS = 15_000;

function formatRevenue(n: number): string {
	if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
	return `$${n.toFixed(0)}`;
}

function formatTimeAgo(iso: string): string {
	const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (sec < 5) return "just now";
	if (sec < 60) return `${sec}s ago`;
	const min = Math.floor(sec / 60);
	return `${min}m ago`;
}

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
	const [display, setDisplay] = useState(0);
	const prevRef = useRef(0);

	useEffect(() => {
		const from = prevRef.current;
		const to = value;
		if (from === to) {
			setDisplay(to);
			return;
		}
		const duration = 800;
		const start = performance.now();

		function tick(now: number) {
			const elapsed = now - start;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			setDisplay(Math.round(from + (to - from) * eased));
			if (progress < 1) requestAnimationFrame(tick);
		}

		requestAnimationFrame(tick);
		prevRef.current = to;
	}, [value]);

	return (
		<span className="tabular-nums">
			{prefix}{display.toLocaleString()}
		</span>
	);
}

export default function MissionControlPage() {
	const searchParams = useSearchParams();
	const isTv = searchParams.get("tv") === "1";

	const [data, setData] = useState<MissionControlData | null>(null);
	const [generatedAt, setGeneratedAt] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [clock, setClock] = useState(new Date());
	const [missionPack, setMissionPack] = useState<{
		id: string;
		title: string;
		briefing_text: string;
		recommended_action: string;
		top_leads_preview: Array<{ address: string; score: number }>;
		total_opportunity_value: number;
		created_at: string;
	} | null>(null);
	const [pipelineRunning, setPipelineRunning] = useState(false);

	const fetchData = useCallback(async () => {
		try {
			const res = await fetch("/api/mission-control/live");
			if (!res.ok) throw new Error("Failed to fetch");
			const json = (await res.json()) as {
				data: MissionControlData;
				meta?: { generatedAt?: string };
			};
			setData(json.data ?? null);
			setGeneratedAt(json.meta?.generatedAt ?? new Date().toISOString());
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}, []);

	const fetchMissionPack = useCallback(async () => {
		try {
			const res = await fetch("/api/storm-pipeline/mission-pack");
			if (!res.ok) return;
			const json = (await res.json()) as { pack?: { id: string; title: string; briefing_text: string; recommended_action: string; top_leads_preview: Array<{ address: string; score: number }>; total_opportunity_value: number; created_at: string } };
			setMissionPack(json.pack ?? null);
		} catch {
			// Ignore
		}
	}, []);

	const runPipeline = useCallback(async () => {
		setPipelineRunning(true);
		try {
			const res = await fetch("/api/storm-pipeline/run", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ triggerType: "manual" }),
			});
			if (res.ok) await fetchMissionPack();
		} finally {
			setPipelineRunning(false);
		}
	}, [fetchMissionPack]);

	useEffect(() => {
		void fetchData();
		const interval = setInterval(fetchData, POLL_INTERVAL_MS);
		return () => clearInterval(interval);
	}, [fetchData]);

	useEffect(() => {
		void fetchMissionPack();
	}, [fetchMissionPack]);

	useEffect(() => {
		const t = setInterval(() => setClock(new Date()), 1000);
		return () => clearInterval(t);
	}, []);

	const [timeAgo, setTimeAgo] = useState("");
	useEffect(() => {
		if (!generatedAt) return;
		const update = () => setTimeAgo(formatTimeAgo(generatedAt));
		update();
		const t = setInterval(update, 1000);
		return () => clearInterval(t);
	}, [generatedAt]);

	if (loading) {
		return <LoadingSkeleton isTv={isTv} />;
	}

	if (error || !data) {
		return (
			<div className="flex min-h-[80vh] items-center justify-center">
				<div className="storm-card-glow p-10 text-center max-w-md">
					<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15">
						<CloudLightning className="h-7 w-7 text-red-400" />
					</div>
					<p className="text-lg font-semibold text-white">Mission Control Unavailable</p>
					<p className="mt-2 text-sm text-storm-muted">{error ?? "Unable to load metrics"}</p>
					<button onClick={fetchData} className="button-primary mt-5 text-sm">
						Retry Connection
					</button>
				</div>
			</div>
		);
	}

	const maxRevenue = Math.max(...data.team.members.map((m) => m.revenue), 1);

	return (
		<div className={`mx-auto max-w-[1920px] space-y-5 ${isTv ? "p-6" : ""}`}>
			{/* ═══ HEADER ═══ */}
			<header className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-storm-purple/20 to-storm-glow/10 shadow-glow-sm">
						<Monitor className="h-6 w-6 text-storm-glow" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-white md:text-3xl tracking-tight">
							Mission Control
						</h1>
						<div className="mt-0.5 flex items-center gap-2 text-sm text-storm-muted">
							<span className="status-dot-live" />
							<span>Live</span>
							<span className="text-storm-border">·</span>
							<span>{timeAgo ? `Updated ${timeAgo}` : "Syncing…"}</span>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<span className="hidden text-sm font-medium text-storm-subtle md:block">
						{clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
					</span>
					<span className="hidden text-storm-border md:block">·</span>
					<span className="hidden text-sm text-storm-subtle md:block">
						{clock.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
					</span>

					{isTv ? (
						<Link
							href="/dashboard/mission-control"
							className="button-secondary flex items-center gap-2 text-xs"
						>
							<Minimize2 className="h-3.5 w-3.5" />
							Exit TV
						</Link>
					) : (
						<Link
							href="/dashboard/mission-control?tv=1"
							className="button-secondary flex items-center gap-2 text-xs"
						>
							<Maximize2 className="h-3.5 w-3.5" />
							TV Mode
						</Link>
					)}
				</div>
			</header>

			{/* ═══ HERO KPI ROW ═══ */}
			<section className="grid grid-cols-2 gap-4 md:grid-cols-4 stagger-children">
				<HeroKpiCard
					icon={<Home className="h-5 w-5" />}
					iconColor="text-amber-400"
					iconBg="bg-amber-500/15"
					accentBorder="border-amber-500/30"
					label="Houses To Hit"
					value={data.kpi.housesToHit}
				/>
				<HeroKpiCard
					icon={<Crosshair className="h-5 w-5" />}
					iconColor="text-storm-glow"
					iconBg="bg-storm-purple/15"
					accentBorder="border-storm-purple/30"
					label="Active Missions"
					value={data.kpi.activeMissions}
				/>
				<HeroKpiCard
					icon={<Users className="h-5 w-5" />}
					iconColor="text-emerald-400"
					iconBg="bg-emerald-500/15"
					accentBorder="border-emerald-500/30"
					label="Reps In Field"
					value={data.kpi.repsInField}
				/>
				<HeroKpiCard
					icon={<Upload className="h-5 w-5" />}
					iconColor="text-blue-400"
					iconBg="bg-blue-500/15"
					accentBorder="border-blue-500/30"
					label="Exports Today"
					value={data.kpi.exportsToday}
				/>
			</section>

			{/* ═══ TEAM PERFORMANCE BAR ═══ */}
			<section className="glass rounded-2xl p-4">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-2">
						<TrendingUp className="h-4 w-4 text-storm-glow" />
						<span className="text-sm font-semibold text-white">Team Performance</span>
						<Badge variant="purple">This Week</Badge>
					</div>
					<div className="flex flex-wrap items-center gap-5 md:gap-8">
						<TeamStat label="Doors" value={data.team.totalDoors.toLocaleString()} />
						<TeamStat label="Appointments" value={data.team.totalAppointments.toLocaleString()} />
						<TeamStat label="Leads" value={data.team.totalLeads.toLocaleString()} />
						<TeamStat label="Closed" value={data.team.totalClosed.toLocaleString()} />
						<TeamStat
							label="Revenue"
							value={formatRevenue(data.team.totalRevenue)}
							highlight
						/>
					</div>
				</div>
			</section>

			{/* ═══ THREE-COLUMN GRID ═══ */}
			<div className="grid gap-5 md:grid-cols-3">
				{/* Column 1: Leaderboard */}
				<div className="storm-card overflow-hidden">
					<div className="glow-line" />
					<div className="flex items-center justify-between p-4 pb-3">
						<div className="flex items-center gap-2">
							<Trophy className="h-4 w-4 text-amber-400" />
							<h3 className="text-sm font-semibold text-white">Top Performers</h3>
						</div>
						{data.team.topPerformer && (
							<Badge variant="warning">{data.team.topPerformer.split(" ")[0]} leads</Badge>
						)}
					</div>

					{data.team.members.length === 0 ? (
						<div className="px-4 pb-5">
							{[1, 2, 3].map((i) => (
								<div key={i} className="flex items-center gap-3 py-3">
									<div className="skeleton h-8 w-8 rounded-lg" />
									<div className="flex-1 space-y-2">
										<div className="skeleton h-3.5 w-3/4 rounded" />
										<div className="skeleton h-2 w-1/2 rounded" />
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="space-y-0 px-4 pb-4">
							{data.team.members.map((m, i) => (
								<div
									key={m.id}
									className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-storm-z2/50"
								>
									<RankMedal rank={i} />
									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between">
											<span className="text-sm font-medium text-white truncate">
												{m.name}
											</span>
											<span className="text-sm font-bold text-storm-glow ml-2 tabular-nums">
												{formatRevenue(m.revenue)}
											</span>
										</div>
										<div className="mt-1.5 flex items-center gap-2">
											<div className="flex-1 h-1.5 rounded-full bg-storm-z2 overflow-hidden">
												<div
													className="h-full rounded-full bg-gradient-to-r from-storm-purple to-storm-glow transition-all duration-700 ease-out"
													style={{
														width: `${Math.max((m.revenue / maxRevenue) * 100, 4)}%`,
													}}
												/>
											</div>
											<span className="text-2xs text-storm-subtle tabular-nums whitespace-nowrap">
												{m.doorsKnocked} doors
											</span>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Column 2: Export Queue + Opportunities */}
				<div className="space-y-5">
					{/* Export Queue */}
					<div className="storm-card p-4">
						<div className="flex items-center gap-2 mb-3">
							<Upload className="h-4 w-4 text-blue-400" />
							<h3 className="text-sm font-semibold text-white">Export Queue</h3>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<ExportStat
								label="Ready"
								value={data.exportQueue.readyCount}
								color="text-white"
							/>
							<ExportStat
								label="Exported Today"
								value={data.exportQueue.exportedTodayCount}
								color="text-emerald-400"
							/>
							<ExportStat
								label="Failed"
								value={data.exportQueue.failedCount}
								color={data.exportQueue.failedCount > 0 ? "text-red-400" : "text-white"}
							/>
							<ExportStat
								label="Success Rate"
								value={data.exportQueue.successRatePercent}
								suffix="%"
								color="text-storm-glow"
							/>
						</div>
					</div>

					{/* Mission Pack (Storm Pipeline) */}
					<div className="storm-card p-4">
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<FileText className="h-4 w-4 text-storm-glow" />
								<h3 className="text-sm font-semibold text-white">Mission Pack</h3>
							</div>
							<button
								type="button"
								onClick={runPipeline}
								disabled={pipelineRunning}
								className="button-secondary flex items-center gap-1.5 text-xs py-1.5 px-2.5"
							>
								<Play className="h-3 w-3" />
								{pipelineRunning ? "Running…" : "Run Pipeline"}
							</button>
						</div>
						{missionPack ? (
							<div className="space-y-2">
								<p className="text-xs font-medium text-storm-subtle">{missionPack.title}</p>
								<p className="text-sm text-white/90 line-clamp-2">{missionPack.briefing_text}</p>
								<div className="flex items-center gap-2">
									<Badge variant={missionPack.recommended_action === "deploy" ? "danger" : missionPack.recommended_action === "monitor" ? "warning" : "default"}>
										{missionPack.recommended_action}
									</Badge>
									<span className="text-2xs text-storm-subtle">
										{missionPack.top_leads_preview?.length ?? 0} leads · ${(missionPack.total_opportunity_value ?? 0).toLocaleString()} opportunity
									</span>
								</div>
							</div>
						) : (
							<p className="text-xs text-storm-subtle">No mission pack yet. Run the pipeline after a storm or for a territory.</p>
						)}
					</div>

					{/* Opportunity Pipeline */}
					{data.opportunities && (
						<div className="storm-card p-4">
							<div className="flex items-center gap-2 mb-3">
								<Target className="h-4 w-4 text-amber-400" />
								<h3 className="text-sm font-semibold text-white">
									Opportunity Pipeline
								</h3>
							</div>
							<div className="grid grid-cols-3 gap-3">
								<div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-3 text-center">
									<p className="text-lg font-bold text-white">
										{formatRevenue(data.opportunities.totalValue)}
									</p>
									<p className="text-2xs text-storm-subtle mt-0.5">Total Value</p>
								</div>
								<div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-3 text-center">
									<p className="text-lg font-bold text-amber-400">
										{data.opportunities.activeZones}
									</p>
									<p className="text-2xs text-storm-subtle mt-0.5">Active Zones</p>
								</div>
								<div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-3 text-center">
									<p className="text-lg font-bold text-red-400">
										{data.opportunities.hotLeads}
									</p>
									<p className="text-2xs text-storm-subtle mt-0.5">Hot Leads</p>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Column 3: Storm Zones + Referral Engine */}
				<div className="space-y-5">
					{/* Storm Zones */}
					<div className="storm-card overflow-hidden">
						<div className="flex items-center gap-2 p-4 pb-3">
							<CloudLightning className="h-4 w-4 text-red-400" />
							<h3 className="text-sm font-semibold text-white">Active Storm Zones</h3>
							{data.opportunities && data.opportunities.stormZones.length > 0 && (
								<Badge variant="danger">
									{data.opportunities.stormZones.length} active
								</Badge>
							)}
						</div>

						{data.opportunities && data.opportunities.stormZones.length > 0 ? (
							<div className="divide-y divide-storm-border/30 px-4 pb-3">
								{data.opportunities.stormZones.map((z) => (
									<div
										key={z.id}
										className="flex items-center justify-between py-2.5"
									>
										<span className="text-sm text-white truncate pr-3">
											{z.location}
										</span>
										<ScoreBadge score={z.opportunityScore} />
									</div>
								))}
							</div>
						) : (
							<div className="px-4 pb-5 text-center">
								<CloudLightning className="mx-auto h-8 w-8 text-storm-subtle/50 mb-2" />
								<p className="text-xs text-storm-subtle">
									No active storm zones detected
								</p>
							</div>
						)}
					</div>

					{/* Referral Engine */}
					{data.referralEngine && (
						<div className="storm-card p-4">
							<div className="flex items-center gap-2 mb-3">
								<Handshake className="h-4 w-4 text-emerald-400" />
								<h3 className="text-sm font-semibold text-white">Referral Engine</h3>
								<Badge variant="success">Enterprise</Badge>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-3 text-center">
									<p className="text-lg font-bold text-white">
										{data.referralEngine.partnersCount}
									</p>
									<p className="text-2xs text-storm-subtle mt-0.5">Partners</p>
								</div>
								<div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-3 text-center">
									<p className="text-lg font-bold text-white">
										{data.referralEngine.referralsCount}
									</p>
									<p className="text-2xs text-storm-subtle mt-0.5">Referrals</p>
								</div>
								<div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-3 text-center">
									<p className="text-lg font-bold text-white">
										{data.referralEngine.closedCount}
									</p>
									<p className="text-2xs text-storm-subtle mt-0.5">Closed</p>
								</div>
								<div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-3 text-center">
									<p className="text-lg font-bold text-emerald-400">
										{formatRevenue(data.referralEngine.totalRevenue)}
									</p>
									<p className="text-2xs text-storm-subtle mt-0.5">Revenue</p>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* ═══ FOOTER ═══ */}
			<footer className="pt-2">
				<div className="glow-line" />
				<div className="flex items-center justify-between pt-3 pb-1">
					<span className="text-2xs text-storm-subtle">
						Powered by <span className="font-semibold text-storm-muted">StormClose</span>
					</span>
					<span className="text-2xs text-storm-subtle tabular-nums">
						{clock.toLocaleTimeString("en-US", {
							hour: "2-digit",
							minute: "2-digit",
							second: "2-digit",
						})}
					</span>
				</div>
			</footer>
		</div>
	);
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function HeroKpiCard({
	icon,
	iconColor,
	iconBg,
	accentBorder,
	label,
	value,
}: {
	icon: React.ReactNode;
	iconColor: string;
	iconBg: string;
	accentBorder: string;
	label: string;
	value: number;
}) {
	return (
		<div
			className={`storm-card-glow relative overflow-hidden border ${accentBorder} p-5 md:p-6`}
		>
			<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-storm-purple/40 to-transparent" />
			<div className="flex items-center justify-between mb-3">
				<div className={`rounded-xl p-2 ${iconBg}`}>
					<span className={iconColor}>{icon}</span>
				</div>
			</div>
			<p className="text-4xl font-bold text-white md:text-5xl animate-count-up">
				<AnimatedNumber value={value} />
			</p>
			<p className="mt-1 text-xs uppercase tracking-wider text-storm-subtle font-medium">
				{label}
			</p>
		</div>
	);
}

function TeamStat({
	label,
	value,
	highlight,
}: {
	label: string;
	value: string;
	highlight?: boolean;
}) {
	return (
		<div className="text-center md:text-left">
			<p
				className={`text-lg font-bold md:text-xl tabular-nums ${
					highlight ? "text-gradient-purple" : "text-white"
				}`}
			>
				{value}
			</p>
			<p className="text-2xs text-storm-subtle uppercase tracking-wider">{label}</p>
		</div>
	);
}

function RankMedal({ rank }: { rank: number }) {
	if (rank === 0) {
		return (
			<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/30 to-orange-500/20 text-amber-400 text-xs font-bold border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.25)]">
				1
			</span>
		);
	}
	if (rank === 1) {
		return (
			<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-300/20 to-slate-400/10 text-slate-300 text-xs font-bold border border-slate-400/20">
				2
			</span>
		);
	}
	if (rank === 2) {
		return (
			<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-700/25 to-orange-800/15 text-amber-600 text-xs font-bold border border-amber-700/25">
				3
			</span>
		);
	}
	return (
		<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-storm-z2 text-storm-subtle text-xs font-bold border border-storm-border/50">
			{rank + 1}
		</span>
	);
}

function ExportStat({
	label,
	value,
	color,
	suffix = "",
}: {
	label: string;
	value: number;
	color: string;
	suffix?: string;
}) {
	return (
		<div className="rounded-xl bg-storm-z2/50 border border-storm-border/50 p-3">
			<p className="text-2xs text-storm-subtle">{label}</p>
			<p className={`text-xl font-bold tabular-nums ${color}`}>
				{value.toLocaleString()}
				{suffix}
			</p>
		</div>
	);
}

function ScoreBadge({ score }: { score: number }) {
	const variant = score >= 70 ? "danger" : score >= 40 ? "warning" : "default";
	return (
		<Badge variant={variant} className="tabular-nums">
			<Zap className="h-3 w-3" /> {score}
		</Badge>
	);
}

function LoadingSkeleton({ isTv }: { isTv: boolean }) {
	return (
		<div className={`mx-auto max-w-[1920px] space-y-5 animate-fade-in ${isTv ? "p-6" : ""}`}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<div className="skeleton h-12 w-12 rounded-2xl" />
					<div className="space-y-2">
						<div className="skeleton h-7 w-48 rounded-lg" />
						<div className="skeleton h-4 w-32 rounded" />
					</div>
				</div>
				<div className="skeleton h-9 w-28 rounded-xl" />
			</div>
			{/* KPI Row */}
			<div className="grid grid-cols-2 gap-4 md:grid-cols-4 stagger-children">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="storm-card p-5 space-y-3">
						<div className="skeleton h-10 w-10 rounded-xl" />
						<div className="skeleton h-10 w-24 rounded-lg" />
						<div className="skeleton h-3 w-20 rounded" />
					</div>
				))}
			</div>
			{/* Performance bar */}
			<div className="skeleton h-16 rounded-2xl" />
			{/* Grid */}
			<div className="grid gap-5 md:grid-cols-3">
				{[1, 2, 3].map((i) => (
					<div key={i} className="storm-card p-4 space-y-4">
						<div className="skeleton h-5 w-32 rounded" />
						{[1, 2, 3].map((j) => (
							<div key={j} className="flex items-center gap-3">
								<div className="skeleton h-8 w-8 rounded-lg" />
								<div className="flex-1 space-y-2">
									<div className="skeleton h-3.5 w-3/4 rounded" />
									<div className="skeleton h-2 w-1/2 rounded" />
								</div>
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
}
