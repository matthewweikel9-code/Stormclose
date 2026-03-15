"use client";

import React from "react";
import type { LiveBadgeStatus } from "@/types/mission-control";

// ── Stale Overlay ────────────────────────────────────────────────────────────
// Full-screen overlay for stale/offline states.
// Renders on top of all widgets when data freshness degrades significantly.

interface StaleOverlayProps {
	status: LiveBadgeStatus | "connection-lost" | "full-offline";
	lastPollSecondsAgo: number;
}

export function StaleOverlay({ status, lastPollSecondsAgo }: StaleOverlayProps) {
	if (status === "live" || status === "delayed") return null;

	const minutes = Math.round(lastPollSecondsAgo / 60);

	if (status === "full-offline") {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-storm-bg/90">
				<div className="text-center space-y-4 max-w-md">
					<div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
						<div className="w-4 h-4 rounded-full bg-red-400" />
					</div>
					<h2 className="text-xl font-bold text-white">Mission Control offline</h2>
					<p className="text-storm-muted">
						Check network connection. Last data received {minutes} minutes ago.
					</p>
				</div>
			</div>
		);
	}

	if (status === "connection-lost") {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-storm-bg/80">
				<div className="text-center space-y-3 max-w-sm">
					<div className="w-12 h-12 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center animate-pulse-slow">
						<div className="w-3 h-3 rounded-full bg-yellow-400" />
					</div>
					<h2 className="text-lg font-bold text-white">Connection lost — reconnecting…</h2>
					<p className="text-sm text-storm-muted">
						Last data {minutes} minutes ago. Retrying every 30 seconds.
					</p>
				</div>
			</div>
		);
	}

	// status === "offline" — widgets are dimmed but no full overlay
	return null;
}
