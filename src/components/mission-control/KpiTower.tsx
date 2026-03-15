"use client";

import React, { useEffect, useRef, useState } from "react";
import type { MissionControlKpi } from "@/types/mission-control";

// ── KPI Tower ────────────────────────────────────────────────────────────────
// 5 stacked large-format metrics for the right column of Mission Control.
// Numbers animate with count-up effect when values change.

interface KpiTowerProps {
	kpi: MissionControlKpi;
	stale: boolean;
	className?: string;
}

interface KpiItem {
	label: string;
	key: keyof MissionControlKpi;
	color: string;
	dotColor?: string;
}

const KPI_ITEMS: KpiItem[] = [
	{ label: "REPS IN FIELD", key: "repsInField", color: "text-green-400", dotColor: "bg-green-400" },
	{ label: "ACTIVE MISSIONS", key: "activeMissions", color: "text-storm-purple" },
	{ label: "HOUSES LEFT", key: "housesLeftToHit", color: "text-white" },
	{ label: "QUALIFIED TODAY", key: "qualifiedToday", color: "text-yellow-400" },
	{ label: "SENT TO JN", key: "sentToJobNimbusToday", color: "text-blue-400" },
];

function AnimatedNumber({ value, color }: { value: number; color: string }) {
	const [displayValue, setDisplayValue] = useState(value);
	const [animating, setAnimating] = useState(false);
	const prevRef = useRef(value);

	useEffect(() => {
		if (prevRef.current !== value) {
			setAnimating(true);
			const timer = setTimeout(() => {
				setDisplayValue(value);
				setAnimating(false);
			}, 300);
			prevRef.current = value;
			return () => clearTimeout(timer);
		}
	}, [value]);

	return (
		<span
			className={`text-5xl font-bold tabular-nums transition-opacity duration-300 ${color} ${
				animating ? "animate-count-up" : ""
			}`}
		>
			{displayValue}
		</span>
	);
}

export function KpiTower({ kpi, stale, className = "" }: KpiTowerProps) {
	return (
		<div
			className={`flex flex-col justify-between h-full rounded-2xl border border-storm-border bg-storm-z2 p-4 transition-opacity duration-1000 ${
				stale ? "opacity-50" : "opacity-100"
			} ${className}`}
			role="region"
			aria-label="Key performance indicators"
		>
			{KPI_ITEMS.map((item, idx) => (
				<div
					key={item.key}
					className={`flex flex-col items-center justify-center flex-1 ${
						idx < KPI_ITEMS.length - 1 ? "border-b border-storm-border" : ""
					}`}
				>
					<div className="flex items-center gap-2">
						{item.dotColor && (
							<div className={`w-2.5 h-2.5 rounded-full ${item.dotColor} animate-pulse-slow`} />
						)}
						<AnimatedNumber value={kpi[item.key]} color={item.color} />
					</div>
					<span className="text-sm uppercase tracking-widest text-storm-muted mt-1">
						{item.label}
					</span>
				</div>
			))}
		</div>
	);
}
