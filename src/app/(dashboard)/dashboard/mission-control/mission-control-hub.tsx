"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { HeroMap } from "@/components/mission-control/HeroMap";
import { KpiTower } from "@/components/mission-control/KpiTower";
import { RotatingPanel } from "@/components/mission-control/RotatingPanel";
import { TopRep } from "@/components/mission-control/TopRep";
import { StormAlert } from "@/components/mission-control/StormAlert";
import { BottomTicker } from "@/components/mission-control/BottomTicker";
import { StaleOverlay } from "@/components/mission-control/StaleOverlay";
import type { MissionControlLiveData, LiveBadgeStatus } from "@/types/mission-control";

// ── Constants ────────────────────────────────────────────────────────────────

const PRIMARY_POLL_MS = 30_000;
const STALE_DELAYED_S = 60;
const STALE_OFFLINE_S = 180;
const STALE_CONNECTION_LOST_S = 600;
const STALE_FULL_OFFLINE_S = 1800;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;

// ── Empty state ──────────────────────────────────────────────────────────────

const EMPTY_DATA: MissionControlLiveData = {
	timestamp: new Date().toISOString(),
	kpi: {
		repsInField: 0,
		activeMissions: 0,
		housesLeftToHit: 0,
		qualifiedToday: 0,
		sentToJobNimbusToday: 0,
	},
	reps: [],
	zones: [],
	priorityZone: null,
	hotCluster: null,
	topRep: null,
	insights: [],
	recentEvents: [],
	stormAlerts: [],
	exceptions: [],
};

// ── MissionControlHub ────────────────────────────────────────────────────────

export function MissionControlHub() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const isTV = searchParams.get("tv") === "true";

	const [data, setData] = useState<MissionControlLiveData>(EMPTY_DATA);
	const [loading, setLoading] = useState(true);
	const [lastPollAt, setLastPollAt] = useState<number>(Date.now());
	const [secondsSinceLastPoll, setSecondsSinceLastPoll] = useState(0);
	const [showExitButton, setShowExitButton] = useState(false);
	const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const retryCountRef = useRef(0);
	const abortControllerRef = useRef<AbortController | null>(null);

	// ── Polling ──────────────────────────────────────────────────────

	const fetchData = useCallback(async () => {
		// Abort any in-flight request
		abortControllerRef.current?.abort();
		const controller = new AbortController();
		abortControllerRef.current = controller;

		try {
			const res = await fetch("/api/mission-control/live", {
				signal: controller.signal,
			});

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}

			const json = await res.json();
			if (json.data) {
				setData(json.data);
				setLastPollAt(Date.now());
				retryCountRef.current = 0;
				setLoading(false);
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") return;

			retryCountRef.current++;
			if (retryCountRef.current <= MAX_RETRIES) {
				// Retry after delay
				setTimeout(() => fetchData(), RETRY_DELAY_MS);
			}
			// If retries exhausted, we fall into stale mode naturally
		}
	}, []);

	// Initial fetch + interval
	useEffect(() => {
		fetchData();
		const interval = setInterval(fetchData, PRIMARY_POLL_MS);
		return () => {
			clearInterval(interval);
			abortControllerRef.current?.abort();
		};
	}, [fetchData]);

	// Track seconds since last successful poll
	useEffect(() => {
		const interval = setInterval(() => {
			setSecondsSinceLastPoll(Math.round((Date.now() - lastPollAt) / 1000));
		}, 1000);
		return () => clearInterval(interval);
	}, [lastPollAt]);

	// ── Stale status ─────────────────────────────────────────────────

	const staleStatus = ((): LiveBadgeStatus | "connection-lost" | "full-offline" => {
		if (secondsSinceLastPoll > STALE_FULL_OFFLINE_S) return "full-offline";
		if (secondsSinceLastPoll > STALE_CONNECTION_LOST_S) return "connection-lost";
		if (secondsSinceLastPoll > STALE_OFFLINE_S) return "offline";
		if (secondsSinceLastPoll > STALE_DELAYED_S) return "delayed";
		return "live";
	})();

	const liveBadge: LiveBadgeStatus =
		staleStatus === "connection-lost" || staleStatus === "full-offline"
			? "offline"
			: staleStatus;

	const isStale = staleStatus !== "live";

	// ── TV Mode: Escape key handler ──────────────────────────────────

	useEffect(() => {
		if (!isTV) return;

		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setShowExitButton(true);
				if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
				exitTimerRef.current = setTimeout(() => setShowExitButton(false), 3000);
			}
		};

		const handleClick = () => {
			setShowExitButton(true);
			if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
			exitTimerRef.current = setTimeout(() => setShowExitButton(false), 3000);
		};

		window.addEventListener("keydown", handleKey);
		window.addEventListener("click", handleClick);
		return () => {
			window.removeEventListener("keydown", handleKey);
			window.removeEventListener("click", handleClick);
			if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
		};
	}, [isTV]);

	const exitTvMode = useCallback(() => {
		router.push("/dashboard/mission-control");
	}, [router]);

	const enterTvMode = useCallback(() => {
		router.push("/dashboard/mission-control?tv=true");
	}, [router]);

	// ── Fallback insight (for StormAlert default state) ──────────────

	const fallbackInsight =
		data.insights.length > 1
			? data.insights[data.insights.length - 1] // Use last insight (different from rotating panel)
			: data.insights[0] ?? null;

	// ── Loading state ────────────────────────────────────────────────

	if (loading) {
		return (
			<div className={`${isTV ? "fixed inset-0 z-50" : ""} bg-storm-bg flex items-center justify-center`}>
				<div className="flex flex-col items-center gap-4">
					<div className="w-12 h-12 rounded-full border-2 border-storm-purple border-t-transparent animate-spin" />
					<p className="text-storm-muted text-sm">Loading Mission Control…</p>
				</div>
			</div>
		);
	}

	// ── Render ────────────────────────────────────────────────────────

	const gridContent = (
		<>
			{/* Hero Live Map */}
			<div style={{ gridArea: "map" }}>
				<HeroMap
					reps={data.reps}
					zones={data.zones}
					liveBadge={liveBadge}
					className="h-full"
				/>
			</div>

			{/* KPI Tower */}
			<div style={{ gridArea: "kpi" }}>
				<KpiTower kpi={data.kpi} stale={isStale} className="h-full" />
			</div>

			{/* Rotating Panel */}
			<div style={{ gridArea: "rotating" }}>
				<RotatingPanel
					priorityZone={data.priorityZone}
					hotCluster={data.hotCluster}
					insights={data.insights}
					stale={isStale}
					className="h-full"
				/>
			</div>

			{/* Top Rep */}
			<div style={{ gridArea: "toprep" }}>
				<TopRep topRep={data.topRep} stale={isStale} className="h-full" />
			</div>

			{/* Storm Alert / AI Insight */}
			<div style={{ gridArea: "alert" }}>
				<StormAlert
					alerts={data.stormAlerts}
					fallbackInsight={fallbackInsight}
					className="h-full"
				/>
			</div>

			{/* Bottom Ticker */}
			<div style={{ gridArea: "ticker" }}>
				<BottomTicker events={data.recentEvents} className="h-full" />
			</div>
		</>
	);

	// ── TV Mode (fullscreen) ─────────────────────────────────────────

	if (isTV) {
		return (
			<div className="fixed inset-0 z-50 bg-storm-bg">
				<div
					className="h-screen w-screen p-4 gap-3"
					style={{
						display: "grid",
						gridTemplateColumns: "24fr 36fr 16fr",
						gridTemplateRows: "3fr 3fr 2fr",
						gridTemplateAreas: `
							"map     map     kpi"
							"map     map     rotating"
							"alert   ticker  toprep"
						`,
					}}
				>
					{gridContent}
				</div>

				{/* Stale overlay */}
				<StaleOverlay status={staleStatus} lastPollSecondsAgo={secondsSinceLastPoll} />

				{/* Exit TV Mode button */}
				{showExitButton && (
					<button
						onClick={exitTvMode}
						className="fixed top-6 right-6 z-[60] flex items-center gap-2 px-4 py-2 rounded-xl bg-storm-z3 border border-storm-border text-storm-text text-sm font-medium shadow-depth-3 hover:bg-storm-z2 transition-all animate-fade-in"
					>
						<Minimize2 size={16} />
						Exit TV Mode
					</button>
				)}
			</div>
		);
	}

	// ── Standard mode (within dashboard layout) ──────────────────────

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-storm-text">Mission Control</h1>
					<p className="text-sm text-storm-muted mt-1">
						Live operational view of all field activity
					</p>
				</div>
				<button
					onClick={enterTvMode}
					className="flex items-center gap-2 px-4 py-2 rounded-xl bg-storm-purple text-white text-sm font-medium hover:bg-storm-purple-hover transition-colors shadow-glow-sm"
				>
					<Maximize2 size={16} />
					Launch TV Mode
				</button>
			</div>

			{/* Grid (responsive version for standard mode) */}
			<div
				className="gap-3"
				style={{
					display: "grid",
					gridTemplateColumns: "24fr 36fr 16fr",
					gridTemplateRows: "300px 300px 200px",
					gridTemplateAreas: `
						"map     map     kpi"
						"map     map     rotating"
						"alert   ticker  toprep"
					`,
				}}
			>
				{gridContent}
			</div>
		</div>
	);
}
