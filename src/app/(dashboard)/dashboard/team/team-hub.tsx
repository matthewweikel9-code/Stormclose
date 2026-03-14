"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
	Users,
	MapPin,
	AlertTriangle,
	Activity,
	Trophy,
	DoorOpen,
	Clock,
	RefreshCw,
	ChevronRight,
	X,
	Navigation,
	Battery,
	Wifi,
	WifiOff,
	Target,
	TrendingUp,
	Zap,
	Eye,
	ArrowUpRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Skeleton } from "@/components/ui";
import { useUserRole } from "@/hooks/auth/useUserRole";
import type {
	TeamLiveData,
	TeamKpiStrip,
	TeamRepPosition,
	OpsException,
	ExceptionSeverity,
	LeaderboardPeriod,
} from "@/types/team";
import type { LeaderboardResult } from "@/services/team/exceptionService";

// ── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000;
const EXCEPTION_POLL_MS = 30_000;

type ActiveTab = "live" | "exceptions" | "leaderboard";

const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
	{ id: "live", label: "Live Ops", icon: Activity },
	{ id: "exceptions", label: "Exceptions", icon: AlertTriangle },
	{ id: "leaderboard", label: "Leaderboard", icon: Trophy },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function severityBadgeVariant(severity: ExceptionSeverity) {
	if (severity === "critical") return "danger" as const;
	if (severity === "warning") return "warning" as const;
	return "info" as const;
}

function fieldStatusColor(status: string) {
	switch (status) {
		case "active":
		case "at_door":
			return "bg-green-500";
		case "driving":
			return "bg-blue-500";
		case "idle":
			return "bg-yellow-500";
		case "paused":
			return "bg-orange-500";
		case "offline":
			return "bg-gray-500";
		default:
			return "bg-gray-500";
	}
}

function fieldStatusLabel(status: string) {
	switch (status) {
		case "active":
			return "Active";
		case "at_door":
			return "At Door";
		case "driving":
			return "Driving";
		case "idle":
			return "Idle";
		case "paused":
			return "Paused";
		case "offline":
			return "Offline";
		default:
			return status;
	}
}

// ── Props ────────────────────────────────────────────────────────────────────

interface TeamHubProps {
	metadataRole?: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function TeamHub({ metadataRole }: TeamHubProps) {
	const role = useUserRole({ metadataRole });
	const [activeTab, setActiveTab] = useState<ActiveTab>("live");
	const [liveData, setLiveData] = useState<TeamLiveData | null>(null);
	const [exceptions, setExceptions] = useState<OpsException[]>([]);
	const [leaderboard, setLeaderboard] = useState<LeaderboardResult[]>([]);
	const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>("today");
	const [loading, setLoading] = useState(true);
	const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval>>();
	const exPollRef = useRef<ReturnType<typeof setInterval>>();

	// ── Data Fetching ──────────────────────────────────────────────────────

	const fetchLive = useCallback(async () => {
		try {
			const res = await fetch("/api/team/live");
			const payload = await res.json();
			if (payload.data) setLiveData(payload.data);
		} catch {
			/* network error — retry on next poll */
		}
	}, []);

	const fetchExceptions = useCallback(async () => {
		try {
			const res = await fetch("/api/team/exceptions");
			const payload = await res.json();
			if (Array.isArray(payload.data)) setExceptions(payload.data);
		} catch {
			/* retry */
		}
	}, []);

	const fetchLeaderboard = useCallback(async () => {
		try {
			const res = await fetch(`/api/team/leaderboard?period=${leaderboardPeriod}`);
			const payload = await res.json();
			if (Array.isArray(payload.data)) setLeaderboard(payload.data);
		} catch {
			/* retry */
		}
	}, [leaderboardPeriod]);

	const refreshAll = useCallback(async () => {
		setLoading(true);
		await Promise.all([fetchLive(), fetchExceptions(), fetchLeaderboard()]);
		setLoading(false);
	}, [fetchLive, fetchExceptions, fetchLeaderboard]);

	// ── Effects ────────────────────────────────────────────────────────────

	useEffect(() => {
		void refreshAll();
	}, [refreshAll]);

	// Live polling
	useEffect(() => {
		pollRef.current = setInterval(() => void fetchLive(), POLL_INTERVAL_MS);
		return () => clearInterval(pollRef.current);
	}, [fetchLive]);

	// Exception polling
	useEffect(() => {
		exPollRef.current = setInterval(() => void fetchExceptions(), EXCEPTION_POLL_MS);
		return () => clearInterval(exPollRef.current);
	}, [fetchExceptions]);

	// Re-fetch leaderboard when period changes
	useEffect(() => {
		void fetchLeaderboard();
	}, [leaderboardPeriod, fetchLeaderboard]);

	// ── Derived ────────────────────────────────────────────────────────────

	const kpi = liveData?.kpi ?? null;
	const reps = liveData?.reps ?? [];
	const criticalExceptionCount = exceptions.filter((e) => e.severity === "critical").length;
	const selectedRep = reps.find((r) => r.userId === selectedRepId) ?? null;

	// ── Render ─────────────────────────────────────────────────────────────

	return (
		<div className="grid gap-5">
			{/* ── Header ─────────────────────────────────────────────────────── */}
			<header className="rounded-2xl border border-storm-border bg-storm-z2 p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-2xl font-bold text-white flex items-center gap-3">
							<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-storm-purple to-purple-600 shadow-lg shadow-storm-purple/20">
								<Users className="h-5 w-5 text-white" />
							</span>
							Team Operations
						</h1>
						<p className="mt-1 text-sm text-storm-muted">
							Live field monitoring, exception detection, and rep performance.
						</p>
					</div>
					<div className="flex items-center gap-2">
						{criticalExceptionCount > 0 && (
							<Badge variant="danger" className="animate-pulse">
								{criticalExceptionCount} Critical
							</Badge>
						)}
						<Button onClick={() => void refreshAll()} variant="secondary" size="sm">
							<RefreshCw className="mr-1.5 h-3.5 w-3.5" />
							Refresh
						</Button>
					</div>
				</div>

				{/* KPI Strip */}
				{kpi && (
					<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
						<KpiCard icon={<Activity className="h-4 w-4 text-green-400" />} label="Active" value={kpi.repsActiveCount} />
						<KpiCard icon={<Clock className="h-4 w-4 text-yellow-400" />} label="Idle" value={kpi.repsIdleCount} />
						<KpiCard icon={<AlertTriangle className="h-4 w-4 text-red-400" />} label="Exceptions" value={exceptions.length} />
						<KpiCard icon={<DoorOpen className="h-4 w-4 text-storm-purple" />} label="Doors Today" value={kpi.housesHitTodayCount} />
						<KpiCard icon={<TrendingUp className="h-4 w-4 text-blue-400" />} label="Doors/Hr" value={kpi.avgDoorsPerHour} />
					</div>
				)}
			</header>

			{/* ── Tab Bar ────────────────────────────────────────────────────── */}
			<div className="flex gap-1 overflow-x-auto rounded-xl border border-storm-border bg-storm-z2 p-1.5 scrollbar-hide">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;
					return (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
								isActive
									? "bg-storm-purple/15 text-white shadow-sm"
									: "text-storm-muted hover:bg-storm-z1 hover:text-white"
							}`}
						>
							<Icon className={`h-4 w-4 ${isActive ? "text-storm-purple" : ""}`} />
							{tab.label}
							{tab.id === "exceptions" && exceptions.length > 0 && (
								<span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/20 px-1.5 text-xs text-red-400">
									{exceptions.length}
								</span>
							)}
						</button>
					);
				})}
			</div>

			{/* ── Tab Content ────────────────────────────────────────────────── */}
			{activeTab === "live" && (
				<LiveOpsPanel
					reps={reps}
					loading={loading}
					onSelectRep={setSelectedRepId}
					selectedRepId={selectedRepId}
				/>
			)}

			{activeTab === "exceptions" && (
				<ExceptionsPanel exceptions={exceptions} loading={loading} onSelectRep={setSelectedRepId} />
			)}

			{activeTab === "leaderboard" && (
				<LeaderboardPanel
					leaderboard={leaderboard}
					loading={loading}
					period={leaderboardPeriod}
					onPeriodChange={setLeaderboardPeriod}
				/>
			)}

			{/* ── Rep Detail Drawer ──────────────────────────────────────────── */}
			{selectedRep && (
				<RepDetailDrawer
					rep={selectedRep}
					exceptions={exceptions.filter((e) => e.context.repId === selectedRep.userId)}
					onClose={() => setSelectedRepId(null)}
				/>
			)}
		</div>
	);
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
	return (
		<div className="flex items-center gap-3 rounded-xl border border-storm-border bg-storm-z1 px-3 py-2">
			{icon}
			<div>
				<p className="text-lg font-bold text-white">{value}</p>
				<p className="text-xs text-storm-muted">{label}</p>
			</div>
		</div>
	);
}

// ── Live Ops Panel ───────────────────────────────────────────────────────────

function LiveOpsPanel({
	reps,
	loading,
	onSelectRep,
	selectedRepId,
}: {
	reps: TeamRepPosition[];
	loading: boolean;
	onSelectRep: (id: string) => void;
	selectedRepId: string | null;
}) {
	if (loading && reps.length === 0) {
		return (
			<div className="grid gap-4 lg:grid-cols-3">
				{[1, 2, 3, 4, 5, 6].map((i) => (
					<Skeleton key={i} className="h-32 rounded-xl" />
				))}
			</div>
		);
	}

	if (reps.length === 0) {
		return (
			<Card>
				<CardContent className="py-12 text-center text-storm-muted">
					<Users className="mx-auto mb-3 h-10 w-10 opacity-50" />
					<p className="text-sm">No reps currently in the field.</p>
					<p className="mt-1 text-xs">Deploy a mission to see live activity here.</p>
				</CardContent>
			</Card>
		);
	}

	const activeReps = reps.filter((r) => r.fieldStatus !== "offline");
	const offlineReps = reps.filter((r) => r.fieldStatus === "offline");

	return (
		<div className="space-y-5">
			{/* Rep Map Fallback: Status Board */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MapPin className="h-4 w-4 text-storm-purple" />
						Live Rep Status Board
						<Badge variant="live" className="ml-auto">
							Live
						</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent>
					{activeReps.length > 0 && (
						<div className="mb-4">
							<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-storm-muted">
								Active ({activeReps.length})
							</p>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{activeReps.map((rep) => (
									<RepCard
										key={rep.userId}
										rep={rep}
										isSelected={selectedRepId === rep.userId}
										onClick={() => onSelectRep(rep.userId)}
									/>
								))}
							</div>
						</div>
					)}
					{offlineReps.length > 0 && (
						<div>
							<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-storm-muted">
								Offline ({offlineReps.length})
							</p>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{offlineReps.map((rep) => (
									<RepCard
										key={rep.userId}
										rep={rep}
										isSelected={selectedRepId === rep.userId}
										onClick={() => onSelectRep(rep.userId)}
									/>
								))}
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

// ── Rep Card ─────────────────────────────────────────────────────────────────

function RepCard({
	rep,
	isSelected,
	onClick,
}: {
	rep: TeamRepPosition;
	isSelected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className={`w-full rounded-xl border px-4 py-3 text-left transition-all hover:border-storm-purple ${
				isSelected
					? "border-storm-purple bg-storm-purple/10"
					: "border-storm-border bg-storm-z1"
			}`}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<span className={`h-2.5 w-2.5 rounded-full ${fieldStatusColor(rep.fieldStatus)}`} />
					<span className="text-sm font-semibold text-white">{rep.name}</span>
				</div>
				<Badge variant="outline" className="text-xs">
					{fieldStatusLabel(rep.fieldStatus)}
				</Badge>
			</div>

			{rep.activeMission && (
				<div className="mt-2 space-y-1">
					<p className="text-xs text-storm-muted">{rep.activeMission.name}</p>
					<div className="flex items-center gap-2">
						<div className="h-1.5 flex-1 rounded-full bg-storm-z2">
							<div
								className="h-1.5 rounded-full bg-storm-purple"
								style={{ width: `${rep.activeMission.completionPercent}%` }}
							/>
						</div>
						<span className="text-xs text-storm-muted">
							{rep.activeMission.stopsCompleted}/{rep.activeMission.stopsCompleted + rep.activeMission.stopsRemaining}
						</span>
					</div>
				</div>
			)}

			{rep.lastHeartbeatSecondsAgo > 0 && (
				<p className="mt-1.5 flex items-center gap-1 text-xs text-storm-muted">
					{rep.lastHeartbeatSecondsAgo < 60 ? (
						<>
							<Wifi className="h-3 w-3 text-green-400" />
							{rep.lastHeartbeatSecondsAgo}s ago
						</>
					) : (
						<>
							<WifiOff className="h-3 w-3 text-yellow-400" />
							{Math.round(rep.lastHeartbeatSecondsAgo / 60)}m ago
						</>
					)}
				</p>
			)}
		</button>
	);
}

// ── Exceptions Panel ─────────────────────────────────────────────────────────

function ExceptionsPanel({
	exceptions,
	loading,
	onSelectRep,
}: {
	exceptions: OpsException[];
	loading: boolean;
	onSelectRep: (id: string) => void;
}) {
	if (loading && exceptions.length === 0) {
		return (
			<div className="space-y-3">
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-20 rounded-xl" />
				))}
			</div>
		);
	}

	if (exceptions.length === 0) {
		return (
			<Card>
				<CardContent className="py-12 text-center text-storm-muted">
					<Zap className="mx-auto mb-3 h-10 w-10 text-green-400 opacity-60" />
					<p className="text-sm font-medium text-white">All Clear</p>
					<p className="mt-1 text-xs">No exceptions detected. Your team is operating smoothly.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-3">
			{exceptions.map((exception) => (
				<ExceptionCard
					key={exception.id}
					exception={exception}
					onSelectRep={onSelectRep}
				/>
			))}
		</div>
	);
}

function ExceptionCard({
	exception,
	onSelectRep,
}: {
	exception: OpsException;
	onSelectRep: (id: string) => void;
}) {
	return (
		<Card>
			<CardContent className="py-3">
				<div className="flex items-start gap-3">
					<div className="mt-0.5">
						{exception.severity === "critical" ? (
							<AlertTriangle className="h-5 w-5 text-red-400" />
						) : exception.severity === "warning" ? (
							<AlertTriangle className="h-5 w-5 text-yellow-400" />
						) : (
							<Eye className="h-5 w-5 text-blue-400" />
						)}
					</div>
					<div className="flex-1">
						<div className="flex items-center gap-2">
							<h3 className="text-sm font-semibold text-white">{exception.title}</h3>
							<Badge variant={severityBadgeVariant(exception.severity)}>
								{exception.severity}
							</Badge>
						</div>
						<p className="mt-0.5 text-xs text-storm-muted">{exception.description}</p>
						<p className="mt-1.5 text-xs text-storm-purple">{exception.suggestedAction}</p>
					</div>
					{exception.context.repId && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onSelectRep(exception.context.repId!)}
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

// ── Leaderboard Panel ────────────────────────────────────────────────────────

function LeaderboardPanel({
	leaderboard,
	loading,
	period,
	onPeriodChange,
}: {
	leaderboard: LeaderboardResult[];
	loading: boolean;
	period: LeaderboardPeriod;
	onPeriodChange: (period: LeaderboardPeriod) => void;
}) {
	const periods: { id: LeaderboardPeriod; label: string }[] = [
		{ id: "today", label: "Today" },
		{ id: "week", label: "This Week" },
		{ id: "month", label: "This Month" },
	];

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Trophy className="h-4 w-4 text-yellow-400" />
						Rep Leaderboard
					</CardTitle>
					<div className="flex gap-1">
						{periods.map((p) => (
							<Button
								key={p.id}
								variant={period === p.id ? "primary" : "secondary"}
								size="sm"
								onClick={() => onPeriodChange(p.id)}
							>
								{p.label}
							</Button>
						))}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{loading && leaderboard.length === 0 ? (
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-16 rounded-xl" />
						))}
					</div>
				) : leaderboard.length === 0 ? (
					<p className="py-8 text-center text-sm text-storm-muted">
						No activity recorded for this period.
					</p>
				) : (
					<div className="space-y-2">
						{leaderboard.map((entry) => (
							<LeaderboardRow key={entry.userId} entry={entry} />
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function LeaderboardRow({ entry }: { entry: LeaderboardResult }) {
	const rankStyle =
		entry.rank === 1
			? "from-yellow-500/20 to-yellow-600/5 border-yellow-500/30"
			: entry.rank === 2
				? "from-gray-400/20 to-gray-500/5 border-gray-400/30"
				: entry.rank === 3
					? "from-orange-500/20 to-orange-600/5 border-orange-500/30"
					: "from-storm-z1 to-storm-z1 border-storm-border";

	const rankEmoji = entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`;

	return (
		<div
			className={`flex items-center gap-4 rounded-xl border bg-gradient-to-r px-4 py-3 ${rankStyle}`}
		>
			<span className="w-8 text-center text-lg">{rankEmoji}</span>
			<div className="flex-1">
				<p className="text-sm font-semibold text-white">{entry.name}</p>
				{entry.branchName && (
					<p className="text-xs text-storm-muted">{entry.branchName}</p>
				)}
			</div>
			<div className="grid grid-cols-4 gap-4 text-center">
				<div>
					<p className="text-sm font-bold text-white">{entry.metrics.doorsKnocked}</p>
					<p className="text-xs text-storm-muted">Doors</p>
				</div>
				<div>
					<p className="text-sm font-bold text-green-400">{entry.metrics.appointmentsSet}</p>
					<p className="text-xs text-storm-muted">Appts</p>
				</div>
				<div>
					<p className="text-sm font-bold text-storm-purple">
						{(entry.metrics.conversionRate * 100).toFixed(0)}%
					</p>
					<p className="text-xs text-storm-muted">Conv</p>
				</div>
				<div>
					<p className="text-sm font-bold text-blue-400">{entry.metrics.doorsPerHour}</p>
					<p className="text-xs text-storm-muted">D/Hr</p>
				</div>
			</div>
		</div>
	);
}

// ── Rep Detail Drawer ────────────────────────────────────────────────────────

function RepDetailDrawer({
	rep,
	exceptions,
	onClose,
}: {
	rep: TeamRepPosition;
	exceptions: OpsException[];
	onClose: () => void;
}) {
	return (
		<div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-storm-border bg-storm-z2 shadow-2xl">
			{/* Drawer Header */}
			<div className="flex items-center justify-between border-b border-storm-border px-5 py-4">
				<div className="flex items-center gap-3">
					<span className={`h-3 w-3 rounded-full ${fieldStatusColor(rep.fieldStatus)}`} />
					<div>
						<h2 className="text-lg font-bold text-white">{rep.name}</h2>
						<p className="text-xs text-storm-muted">
							{fieldStatusLabel(rep.fieldStatus)} · Last heartbeat {rep.lastHeartbeatSecondsAgo}s ago
						</p>
					</div>
				</div>
				<button
					onClick={onClose}
					className="rounded-lg p-1.5 text-storm-muted transition-colors hover:bg-storm-z1 hover:text-white"
				>
					<X className="h-5 w-5" />
				</button>
			</div>

			{/* Drawer Body */}
			<div className="flex-1 overflow-y-auto p-5 space-y-4">
				{/* Position */}
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Position</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-3 text-xs">
							<div>
								<p className="text-storm-muted">Coordinates</p>
								<p className="text-white">
									{rep.lat.toFixed(4)}, {rep.lng.toFixed(4)}
								</p>
							</div>
							<div>
								<p className="text-storm-muted">Accuracy</p>
								<p className="text-white">{rep.accuracyMeters}m</p>
							</div>
							{rep.heading !== null && (
								<div>
									<p className="text-storm-muted">Heading</p>
									<p className="text-white flex items-center gap-1">
										<Navigation className="h-3 w-3" />
										{rep.heading}°
									</p>
								</div>
							)}
							{rep.speedMps !== null && (
								<div>
									<p className="text-storm-muted">Speed</p>
									<p className="text-white">{(rep.speedMps * 2.237).toFixed(1)} mph</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Active Mission */}
				{rep.activeMission && (
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Active Mission</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm font-medium text-white">{rep.activeMission.name}</p>
							{rep.activeMission.stormZoneName && (
								<p className="text-xs text-storm-muted">{rep.activeMission.stormZoneName}</p>
							)}
							<div className="mt-2 flex items-center gap-2">
								<div className="h-2 flex-1 rounded-full bg-storm-z1">
									<div
										className="h-2 rounded-full bg-storm-purple transition-all"
										style={{ width: `${rep.activeMission.completionPercent}%` }}
									/>
								</div>
								<span className="text-xs font-medium text-white">
									{rep.activeMission.completionPercent}%
								</span>
							</div>
							<div className="mt-2 grid grid-cols-2 gap-2 text-xs">
								<div>
									<p className="text-storm-muted">Completed</p>
									<p className="text-white">{rep.activeMission.stopsCompleted} stops</p>
								</div>
								<div>
									<p className="text-storm-muted">Remaining</p>
									<p className="text-white">{rep.activeMission.stopsRemaining} stops</p>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Exceptions */}
				{exceptions.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle className="text-sm flex items-center gap-2">
								<AlertTriangle className="h-4 w-4 text-red-400" />
								Active Exceptions ({exceptions.length})
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							{exceptions.map((ex) => (
								<div
									key={ex.id}
									className="rounded-lg border border-storm-border bg-storm-z1 p-2.5"
								>
									<div className="flex items-center gap-2">
										<Badge variant={severityBadgeVariant(ex.severity)}>
											{ex.severity}
										</Badge>
										<span className="text-xs font-medium text-white">{ex.title}</span>
									</div>
									<p className="mt-1 text-xs text-storm-muted">{ex.description}</p>
								</div>
							))}
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
