"use client";

import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { getDashboardTodayMockData } from "@/lib/dashboard/mockData";

interface DashboardV2Props {
	metadataRole?: string | null;
}

type ApiEnvelope<T> = {
	data: T | null;
	error: string | null;
	meta?: Record<string, unknown>;
};

type DashboardTodayData = ReturnType<typeof getDashboardTodayMockData>;

export function DashboardV2({ metadataRole }: DashboardV2Props) {
	void metadataRole;
	const [data, setData] = useState<DashboardTodayData>(getDashboardTodayMockData());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

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
		<div className="space-y-4">
			{error ? <ErrorState title="Dashboard is running in fallback mode" description={error} /> : null}
			<section className="grid grid-cols-2 gap-3 rounded-2xl border border-storm-border bg-storm-z2 p-4">
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
		</div>
	);
}
