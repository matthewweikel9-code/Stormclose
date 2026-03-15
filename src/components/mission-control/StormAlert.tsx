"use client";

import React, { useState, useEffect, useRef } from "react";
import type { McStormAlert } from "@/types/mission-control";

// ── Storm Alert ──────────────────────────────────────────────────────────────
// Shows active storm alerts with red flash animation.
// Falls back to AI ops insight when no alerts are active.

interface StormAlertProps {
	alerts: McStormAlert[];
	fallbackInsight: string | null;
	className?: string;
}

const ALERT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function StormAlert({ alerts, fallbackInsight, className = "" }: StormAlertProps) {
	const [flashActive, setFlashActive] = useState(false);
	const prevAlertCountRef = useRef(alerts.length);

	// Flash on new alert arrival
	useEffect(() => {
		if (alerts.length > prevAlertCountRef.current) {
			setFlashActive(true);
			const timer = setTimeout(() => setFlashActive(false), 2000);
			prevAlertCountRef.current = alerts.length;
			return () => clearTimeout(timer);
		}
		prevAlertCountRef.current = alerts.length;
	}, [alerts.length]);

	const hasAlerts = alerts.length > 0;
	const visibleAlerts = alerts.slice(0, 3); // Max 3 visible

	return (
		<div
			className={`relative rounded-2xl border border-storm-border overflow-hidden h-full transition-all duration-300 ${className}`}
			role="region"
			aria-label={hasAlerts ? "Active storm alert" : "AI operations insight"}
		>
			{/* Background flash for alerts */}
			{hasAlerts && (
				<div
					className={`absolute inset-0 transition-colors duration-200 ${
						flashActive ? "bg-red-500/30" : "bg-red-500/10"
					}`}
				/>
			)}

			{/* Default: no alert bg */}
			{!hasAlerts && <div className="absolute inset-0 bg-storm-z2" />}

			{/* Content */}
			<div className="relative h-full flex flex-col justify-center p-4">
				{hasAlerts ? (
					<div className="flex flex-col gap-3">
						{visibleAlerts.map((alert) => (
							<div key={alert.id} className="animate-fade-in">
								<div className="flex items-center gap-2">
									<span className="text-xl animate-glow">⚡</span>
									<span className="text-lg font-bold text-red-400">
										NEW STORM: {alert.zoneName}
									</span>
								</div>
								<p className="text-sm text-storm-muted mt-1">
									{alert.eventCount} events
									{alert.maxHailSizeInches ? ` · ${alert.maxHailSizeInches}" hail` : ""}
									{` · ${alert.houseCount} houses`}
								</p>
							</div>
						))}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center gap-2">
						<span className="text-xs uppercase tracking-widest text-storm-muted">
							AI Ops Insight
						</span>
						{fallbackInsight ? (
							<p className="text-sm text-storm-text text-center leading-relaxed">
								{fallbackInsight}
							</p>
						) : (
							<p className="text-sm text-storm-subtle text-center">
								No operational insights available
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
