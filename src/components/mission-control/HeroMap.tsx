"use client";

import React, { useRef, useEffect, useMemo } from "react";
import type { McRepPosition, McZoneOverlay, LiveBadgeStatus } from "@/types/mission-control";

// ── Map placeholder ──────────────────────────────────────────────────────────
// In production this would use Mapbox GL JS with dark-v11 style.
// For the initial implementation we render a styled placeholder
// with rep dots drawn as absolute-positioned elements, since Mapbox
// requires a valid token and a browser canvas. This keeps tests and
// dev mode working without a Mapbox account.

interface HeroMapProps {
	reps: McRepPosition[];
	zones: McZoneOverlay[];
	liveBadge: LiveBadgeStatus;
	className?: string;
}

const REP_STATUS_COLORS: Record<McRepPosition["fieldStatus"], string> = {
	active: "#10B981",
	at_door: "#10B981",
	driving: "#3B82F6",
	idle: "#F59E0B",
	offline: "#64748B",
};

const REP_STATUS_SIZES: Record<McRepPosition["fieldStatus"], number> = {
	active: 12,
	at_door: 12,
	driving: 10,
	idle: 10,
	offline: 8,
};

function badgeStyles(status: LiveBadgeStatus): { bg: string; dotBg: string; label: string } {
	switch (status) {
		case "live":
			return { bg: "bg-green-500/20", dotBg: "bg-green-400", label: "LIVE" };
		case "delayed":
			return { bg: "bg-yellow-500/20", dotBg: "bg-yellow-400", label: "DELAYED" };
		case "offline":
			return { bg: "bg-red-500/20", dotBg: "bg-red-400", label: "OFFLINE" };
	}
}

export function HeroMap({ reps, zones, liveBadge, className = "" }: HeroMapProps) {
	const badge = badgeStyles(liveBadge);
	const now = useMemo(() => {
		const d = new Date();
		return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
	}, []);

	return (
		<div
			className={`relative rounded-2xl overflow-hidden border border-storm-border bg-storm-z1 ${className}`}
			role="img"
			aria-label="Live operations map"
		>
			{/* Map background */}
			<div className="absolute inset-0 bg-gradient-to-br from-storm-z0 via-storm-z1 to-storm-z2" />

			{/* Grid lines (visual texture for empty map) */}
			<div className="absolute inset-0 opacity-10">
				<div className="h-full w-full" style={{
					backgroundImage:
						"linear-gradient(rgba(109,92,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(109,92,255,0.15) 1px, transparent 1px)",
					backgroundSize: "60px 60px",
				}} />
			</div>

			{/* Rep dots */}
			{reps.length > 0 && (
				<div className="absolute inset-0">
					{reps.map((rep, idx) => {
						const color = REP_STATUS_COLORS[rep.fieldStatus];
						const size = REP_STATUS_SIZES[rep.fieldStatus];
						const shouldPulse = rep.fieldStatus === "active" || rep.fieldStatus === "at_door";
						// Distribute dots in a visible pattern within the map area
						const x = 20 + ((idx * 137) % 60);
						const y = 20 + ((idx * 97) % 60);
						return (
							<div
								key={rep.userId}
								className="absolute flex flex-col items-center"
								style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
							>
								<div
									className={`rounded-full ${shouldPulse ? "animate-pulse-slow" : ""}`}
									style={{
										width: size,
										height: size,
										backgroundColor: color,
										boxShadow: `0 0 ${size}px ${color}60`,
									}}
								/>
								<span className="text-2xs text-storm-muted mt-1 whitespace-nowrap font-medium">
									{rep.name.slice(0, 12)}
									{rep.completionPercent > 0 && ` ${rep.completionPercent}%`}
								</span>
							</div>
						);
					})}
				</div>
			)}

			{/* Empty state */}
			{reps.length === 0 && zones.length === 0 && (
				<div className="absolute inset-0 flex items-center justify-center">
					<p className="text-storm-subtle text-lg">No active field operations</p>
				</div>
			)}

			{/* Overlay: clock */}
			<div className="absolute top-4 right-4 text-xl text-storm-muted font-medium">
				{now}
			</div>

			{/* Overlay: live badge */}
			<div className={`absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full ${badge.bg}`}>
				<div className={`w-2.5 h-2.5 rounded-full ${badge.dotBg} ${liveBadge === "live" ? "animate-pulse-slow" : ""}`} />
				<span className={`text-sm font-semibold tracking-wide ${
					liveBadge === "live" ? "text-green-400" :
					liveBadge === "delayed" ? "text-yellow-400" :
					"text-red-400"
				}`}>
					{badge.label}
				</span>
			</div>
		</div>
	);
}
