"use client";

import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/auth/useUserRole";
import { getVisibleDashboardWidgets } from "@/config/dashboardWidgets";
import type { ApiEnvelope, DashboardTodayData } from "@/types/dashboard";
import { AIDailyBriefWidget } from "@/components/dashboard/AIDailyBrief";
import { HousesToHitTodayWidget } from "@/components/dashboard/HousesToHitToday";
import { TopStormZonesWidget } from "@/components/dashboard/TopStormZones";
import { AIDeploymentPlanWidget } from "@/components/dashboard/AIDeploymentPlan";
import { LiveTeamSnapshotWidget } from "@/components/dashboard/LiveTeamSnapshot";
import { UnassignedHotClustersWidget } from "@/components/dashboard/UnassignedHotClusters";
import { RecentQualifiedOppsWidget } from "@/components/dashboard/RecentQualifiedOpps";
import { ExportQueueSummaryWidget } from "@/components/dashboard/ExportQueueSummary";
import { DataHealthWidget } from "@/components/dashboard/DataHealth";
import { Badge, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { getDashboardTodayMockData } from "@/lib/dashboard/mockData";

interface DashboardV2Props {
	metadataRole?: string | null;
}

export function DashboardV2({ metadataRole }: DashboardV2Props) {
	const role = useUserRole({ metadataRole });
	const visibleWidgets = getVisibleDashboardWidgets(role);
	const [data, setData] = useState<DashboardTodayData>(getDashboardTodayMockData());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [generatedAt, setGeneratedAt] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const fetchData = async () => {
			try {
				setError(null);
				const response = await fetch("/api/dashboard/today");
				if (!response.ok) {
					throw new Error("Failed to fetch dashboard data");
				}
				const payload = (await response.json()) as ApiEnvelope<DashboardTodayData>;
				if (!cancelled && payload.data) {
					setData(payload.data);
					setGeneratedAt(typeof payload.meta?.generatedAt === "string" ? payload.meta.generatedAt : null);
				}
			} catch (fetchError) {
				if (!cancelled) {
					setData(getDashboardTodayMockData());
					setError(fetchError instanceof Error ? fetchError.message : "Failed to load dashboard");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		void fetchData();
		const interval = window.setInterval(() => {
			void fetchData();
		}, 5 * 60 * 1000);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, []);

	const generatedAgoMinutes = generatedAt
		? Math.max(0, Math.floor((Date.now() - new Date(generatedAt).getTime()) / 60000))
		: null;
	const stale = generatedAgoMinutes !== null && generatedAgoMinutes > 360;

	if (loading) {
		return (
			<LoadingState title="Loading dashboard…" description="Pulling latest operations data." />
		);
	}

	if (!data.housesToHitToday.length && !data.topStormZones.length) {
		return (
			<EmptyState
				title="No dashboard data yet"
				description="As storm and mission data arrives, this view will populate automatically."
			/>
		);
	}

	return (
		<div className="space-y-6">
			{error ? <ErrorState title="Dashboard is running in fallback mode" description={error} /> : null}
			<section className="grid grid-cols-1 gap-3 rounded-2xl border border-storm-border bg-storm-z2 p-4 sm:grid-cols-2 xl:grid-cols-4">
				<div className="col-span-full flex items-center justify-end">
					<Badge variant={stale ? "warning" : "info"}>
						{generatedAgoMinutes === null ? "Updated: unknown" : `Updated ${generatedAgoMinutes}m ago`}
					</Badge>
				</div>
				<div className="rounded-xl border border-storm-border bg-storm-z1 p-3">
					<p className="text-[11px] uppercase tracking-wide text-storm-subtle">Houses To Hit</p>
					<p className="text-xl font-bold text-storm-purple">{data.kpi.housesToHitCount}</p>
				</div>
				<div className="rounded-xl border border-storm-border bg-storm-z1 p-3">
					<p className="text-[11px] uppercase tracking-wide text-storm-subtle">Active Missions</p>
					<p className="text-xl font-bold text-white">{data.kpi.activeMissionCount}</p>
				</div>
				<div className="rounded-xl border border-storm-border bg-storm-z1 p-3">
					<p className="text-[11px] uppercase tracking-wide text-storm-subtle">Reps In Field</p>
					<p className="text-xl font-bold text-white">{data.kpi.repsInFieldCount}</p>
				</div>
				<div className="rounded-xl border border-storm-border bg-storm-z1 p-3">
					<p className="text-[11px] uppercase tracking-wide text-storm-subtle">Exports Today</p>
					<p className="text-xl font-bold text-white">{data.kpi.exportsTodayCount}</p>
				</div>
			</section>

			<section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
				{visibleWidgets.includes("aiDailyBrief") && (
					<div className="xl:col-span-2">
						<AIDailyBriefWidget brief={data.aiDailyBrief} />
					</div>
				)}

				{visibleWidgets.includes("housesToHitToday") && (
					<div className="xl:col-span-2 xl:row-span-2">
						<HousesToHitTodayWidget houses={data.housesToHitToday} />
					</div>
				)}

				{visibleWidgets.includes("topStormZones") && <TopStormZonesWidget zones={data.topStormZones} />}
				{visibleWidgets.includes("aiDeploymentPlan") && <AIDeploymentPlanWidget plan={data.aiDeploymentPlan} />}
				{visibleWidgets.includes("liveTeamSnapshot") && (
					<LiveTeamSnapshotWidget snapshot={data.liveTeamSnapshot} />
				)}
				{visibleWidgets.includes("unassignedHotClusters") && (
					<UnassignedHotClustersWidget clusters={data.unassignedHotClusters} />
				)}
				{visibleWidgets.includes("recentQualifiedOpps") && (
					<RecentQualifiedOppsWidget opportunities={data.recentQualifiedOpps} />
				)}
				{visibleWidgets.includes("exportQueueSummary") && (
					<ExportQueueSummaryWidget summary={data.exportQueueSummary} />
				)}
				{visibleWidgets.includes("dataHealth") && <DataHealthWidget health={data.dataHealth} />}
			</section>
		</div>
	);
}
