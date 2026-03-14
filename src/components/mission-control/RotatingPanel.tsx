"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { McPriorityZone, McHotCluster } from "@/types/mission-control";

// ── Rotating Panel ───────────────────────────────────────────────────────────
// Cycles through 3 sub-panels: AI Priority Zone → Hot Cluster → AI Insight
// Each panel shows for 15 seconds. Total cycle: 45 seconds. Continuous loop.

interface RotatingPanelProps {
	priorityZone: McPriorityZone | null;
	hotCluster: McHotCluster | null;
	insights: string[];
	stale: boolean;
	className?: string;
}

const PANEL_DURATION_MS = 15_000;
const TOTAL_PANELS = 3;

function PriorityZonePanel({ zone }: { zone: McPriorityZone | null }) {
	if (!zone) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-storm-subtle text-sm">No active storm zones</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center h-full gap-2 p-3">
			<span className="text-xs uppercase tracking-widest text-storm-muted">AI Priority Zone</span>
			<span className="text-lg font-bold text-white text-center leading-tight">{zone.name}</span>
			<span className="text-4xl font-bold text-storm-purple">{zone.score}</span>
			<div className="flex gap-3 text-sm text-storm-muted">
				<span>{zone.houseCount} houses</span>
				{zone.unworkedCount > 0 && (
					<span className="text-yellow-400">Unworked: {zone.unworkedCount}</span>
				)}
			</div>
		</div>
	);
}

function HotClusterPanel({ cluster }: { cluster: McHotCluster | null }) {
	if (!cluster) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-green-400 text-sm">All clusters covered</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center h-full gap-2 p-3">
			<span className="text-xs uppercase tracking-widest text-storm-muted">Unworked Hot Cluster</span>
			<span className="text-lg font-bold text-white text-center leading-tight">{cluster.name}</span>
			<span className="text-3xl font-bold text-yellow-400">{cluster.houseCount}</span>
			<span className="text-sm text-storm-muted">houses</span>
			<span className="text-sm text-storm-subtle">
				{cluster.distanceFromNearestRepMiles} mi from nearest rep
			</span>
			<span className="text-xs text-storm-purple font-medium mt-1">Deploy?</span>
		</div>
	);
}

function InsightPanel({ insights, insightIndex }: { insights: string[]; insightIndex: number }) {
	if (insights.length === 0) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="h-4 w-3/4 bg-storm-z3 rounded animate-shimmer" />
			</div>
		);
	}

	const insight = insights[insightIndex % insights.length];
	return (
		<div className="flex flex-col items-center justify-center h-full gap-3 p-4">
			<span className="text-xs uppercase tracking-widest text-storm-muted">AI Ops Insight</span>
			<p className="text-sm text-storm-text text-center leading-relaxed">{insight}</p>
		</div>
	);
}

export function RotatingPanel({
	priorityZone,
	hotCluster,
	insights,
	stale,
	className = "",
}: RotatingPanelProps) {
	const [activePanel, setActivePanel] = useState(0);
	const [visible, setVisible] = useState(true);
	const [insightIndex, setInsightIndex] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			// Start fade out
			setVisible(false);
			setTimeout(() => {
				setActivePanel((prev) => {
					const next = (prev + 1) % TOTAL_PANELS;
					// Advance insight index when we reach panel C
					if (next === 2) {
						setInsightIndex((i) => i + 1);
					}
					return next;
				});
				setVisible(true);
			}, 500); // 500ms crossfade gap
		}, PANEL_DURATION_MS);

		return () => clearInterval(interval);
	}, []);

	const panelContent = (() => {
		switch (activePanel) {
			case 0:
				return <PriorityZonePanel zone={priorityZone} />;
			case 1:
				return <HotClusterPanel cluster={hotCluster} />;
			case 2:
				return <InsightPanel insights={insights} insightIndex={insightIndex} />;
			default:
				return null;
		}
	})();

	// Rotation indicator dots
	const dots = Array.from({ length: TOTAL_PANELS }, (_, i) => i);

	return (
		<div
			className={`relative rounded-2xl border border-storm-border bg-storm-z2 overflow-hidden h-full transition-opacity duration-1000 ${
				stale ? "opacity-50" : "opacity-100"
			} ${className}`}
			role="region"
			aria-label="Rotating operational panel"
		>
			{/* Background accent per panel */}
			{activePanel === 0 && (
				<div className="absolute inset-0 bg-gradient-to-br from-storm-purple/5 to-transparent animate-pulse-slow" />
			)}
			{activePanel === 1 && (
				<div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent" />
			)}

			{/* Content with crossfade */}
			<div
				className={`relative h-full transition-all duration-500 ease-in-out ${
					visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
				}`}
			>
				{panelContent}
			</div>

			{/* Rotation dots */}
			<div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
				{dots.map((i) => (
					<div
						key={i}
						className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
							i === activePanel ? "bg-storm-purple" : "bg-storm-subtle"
						}`}
					/>
				))}
			</div>

			{/* Stale indicator */}
			{stale && (
				<div className="absolute top-2 right-2">
					<span className="text-2xs text-storm-subtle">Data may be delayed</span>
				</div>
			)}
		</div>
	);
}
