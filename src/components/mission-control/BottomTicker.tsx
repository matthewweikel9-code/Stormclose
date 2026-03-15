"use client";

import React, { useRef, useEffect } from "react";
import type { McTickerEvent } from "@/types/mission-control";

// ── Bottom Ticker ────────────────────────────────────────────────────────────
// Continuously scrolling horizontal ticker showing recent operational events,
// styled like a news crawl.

interface BottomTickerProps {
	events: McTickerEvent[];
	className?: string;
}

function formatTime(iso: string): string {
	try {
		const d = new Date(iso);
		return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
	} catch {
		return "";
	}
}

export function BottomTicker({ events, className = "" }: BottomTickerProps) {
	if (events.length === 0) {
		return (
			<div
				className={`flex items-center justify-center rounded-2xl border border-storm-border bg-storm-z1 h-full ${className}`}
				role="region"
				aria-label="Activity ticker"
			>
				<p className="text-storm-subtle text-sm">
					Waiting for field activity…
				</p>
			</div>
		);
	}

	// Duplicate content for seamless loop
	const tickerContent = [...events, ...events];

	return (
		<div
			className={`relative overflow-hidden rounded-2xl border-y border-storm-border bg-storm-z1 h-full flex items-center ${className}`}
			role="region"
			aria-label="Activity ticker"
		>
			<div className="flex items-center whitespace-nowrap animate-ticker">
				{tickerContent.map((event, idx) => (
					<React.Fragment key={`${event.id}-${idx}`}>
						<span className="inline-flex items-center gap-1.5 px-3 text-sm text-storm-muted">
							<span>{event.icon}</span>
							<span>{event.text}</span>
							<span className="text-storm-subtle text-xs">{formatTime(event.timestamp)}</span>
						</span>
						{idx < tickerContent.length - 1 && (
							<span className="text-storm-subtle mx-1">·</span>
						)}
					</React.Fragment>
				))}
			</div>

			{/* CSS animation is defined in globals.css */}
			<style jsx>{`
				.animate-ticker {
					animation: ticker-scroll 60s linear infinite;
				}
				@keyframes ticker-scroll {
					from {
						transform: translateX(0);
					}
					to {
						transform: translateX(-50%);
					}
				}
			`}</style>
		</div>
	);
}
