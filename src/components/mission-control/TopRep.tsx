"use client";

import React from "react";
import type { McTopRep } from "@/types/mission-control";

// ── Top Rep ──────────────────────────────────────────────────────────────────
// Shows today's leading rep by doors knocked with gold accent border.

interface TopRepProps {
	topRep: McTopRep | null;
	stale: boolean;
	className?: string;
}

function getInitials(name: string): string {
	return name
		.split(/[\s_-]/)
		.map((part) => part[0] ?? "")
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

export function TopRep({ topRep, stale, className = "" }: TopRepProps) {
	if (!topRep) {
		return (
			<div
				className={`flex items-center justify-center rounded-2xl border border-storm-border bg-storm-z2 h-full transition-opacity duration-1000 ${
					stale ? "opacity-50" : ""
				} ${className}`}
				role="region"
				aria-label="Top rep today"
			>
				<p className="text-storm-subtle text-sm">No field activity today</p>
			</div>
		);
	}

	return (
		<div
			className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border bg-storm-z2 h-full p-4 transition-opacity duration-1000 ${
				stale ? "opacity-50" : ""
			} ${className}`}
			style={{
				borderImage: "linear-gradient(135deg, rgba(234,179,8,0.2), rgba(202,138,4,0.05)) 1",
			}}
			role="region"
			aria-label="Top rep today"
		>
			{/* Avatar */}
			<div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500/30 to-yellow-600/10 flex items-center justify-center">
				<span className="text-lg font-bold text-yellow-400">
					{getInitials(topRep.name)}
				</span>
			</div>

			{/* Name + trophy */}
			<div className="flex items-center gap-1.5">
				<span className="text-lg font-bold text-white">{topRep.name}</span>
				<span className="text-lg">🏆</span>
			</div>

			{/* Label */}
			<span className="text-xs uppercase tracking-widest text-storm-muted">
				Top Rep Today
			</span>

			{/* Stats */}
			<span className="text-sm text-storm-muted">
				{topRep.doorsKnocked} doors · {topRep.appointmentsSet} appt{topRep.appointmentsSet !== 1 ? "s" : ""} · {topRep.conversionRate}% conv.
			</span>
		</div>
	);
}
