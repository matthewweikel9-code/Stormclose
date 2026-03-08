"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { StormEvent, WeatherAlert } from "@/lib/storms/types";

interface StormRadarProps {
	storms: StormEvent[];
	alerts: WeatherAlert[];
	onStormSelect: (storm: StormEvent) => void;
	selectedStorm: StormEvent | null;
	isLoading: boolean;
}

const SEVERITY_COLORS = {
	minor: { bg: "bg-blue-500/20", border: "border-blue-500/50", text: "text-blue-400" },
	moderate: { bg: "bg-yellow-500/20", border: "border-yellow-500/50", text: "text-yellow-400" },
	severe: { bg: "bg-orange-500/20", border: "border-orange-500/50", text: "text-orange-400" },
	extreme: { bg: "bg-red-500/20", border: "border-red-500/50", text: "text-red-400" }
};

const EVENT_ICONS = {
	hail: "🧊",
	wind: "💨",
	tornado: "🌪️",
	mixed: "⛈️"
};

export function StormRadar({
	storms,
	alerts,
	onStormSelect,
	selectedStorm,
	isLoading
}: StormRadarProps) {
	const [filterType, setFilterType] = useState<string>("all");
	const [filterSeverity, setFilterSeverity] = useState<string>("all");

	// Filter storms
	const filteredStorms = storms.filter(storm => {
		if (filterType !== "all" && storm.eventType !== filterType) return false;
		if (filterSeverity !== "all" && storm.severity !== filterSeverity) return false;
		return true;
	});

	// Group storms by state
	const stormsByState = filteredStorms.reduce((acc, storm) => {
		const state = storm.state || "Unknown";
		if (!acc[state]) acc[state] = [];
		acc[state].push(storm);
		return acc;
	}, {} as Record<string, StormEvent[]>);

	// Stats
	const stats = {
		total: storms.length,
		hail: storms.filter(s => s.eventType === "hail").length,
		wind: storms.filter(s => s.eventType === "wind").length,
		tornado: storms.filter(s => s.eventType === "tornado").length,
		severe: storms.filter(s => s.severity === "severe" || s.severity === "extreme").length
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="text-center">
					<div className="mb-4 text-4xl animate-pulse">🌪️</div>
					<p className="text-slate-400">Loading storm data...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Stats Bar */}
			<div className="grid grid-cols-5 gap-4">
				<div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-center">
					<p className="text-2xl font-bold text-white">{stats.total}</p>
					<p className="text-xs text-slate-400">Total Reports</p>
				</div>
				<div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-center">
					<p className="text-2xl font-bold text-blue-400">{stats.hail}</p>
					<p className="text-xs text-blue-300/70">🧊 Hail</p>
				</div>
				<div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 text-center">
					<p className="text-2xl font-bold text-cyan-400">{stats.wind}</p>
					<p className="text-xs text-cyan-300/70">💨 Wind</p>
				</div>
				<div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4 text-center">
					<p className="text-2xl font-bold text-purple-400">{stats.tornado}</p>
					<p className="text-xs text-purple-300/70">🌪️ Tornado</p>
				</div>
				<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
					<p className="text-2xl font-bold text-red-400">{stats.severe}</p>
					<p className="text-xs text-red-300/70">⚠️ Severe+</p>
				</div>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap gap-4">
				<div className="flex items-center gap-2">
					<label className="text-sm text-slate-400">Type:</label>
					<select
						value={filterType}
						onChange={(e) => setFilterType(e.target.value)}
						className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white"
					>
						<option value="all">All Types</option>
						<option value="hail">🧊 Hail</option>
						<option value="wind">💨 Wind</option>
						<option value="tornado">🌪️ Tornado</option>
					</select>
				</div>
				<div className="flex items-center gap-2">
					<label className="text-sm text-slate-400">Severity:</label>
					<select
						value={filterSeverity}
						onChange={(e) => setFilterSeverity(e.target.value)}
						className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white"
					>
						<option value="all">All Severities</option>
						<option value="minor">Minor</option>
						<option value="moderate">Moderate</option>
						<option value="severe">Severe</option>
						<option value="extreme">Extreme</option>
					</select>
				</div>
			</div>

			{/* Map Placeholder + Storm List */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Map Placeholder */}
				<div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
					<div className="flex h-[400px] flex-col items-center justify-center text-center">
						<div className="mb-4 text-6xl">🗺️</div>
						<h3 className="text-lg font-semibold text-white">Interactive Storm Map</h3>
						<p className="mt-2 max-w-sm text-sm text-slate-400">
							Live radar integration coming soon. For now, browse storms by state below.
						</p>
						<p className="mt-4 text-xs text-slate-500">
							Add MAPBOX_API_KEY to enable interactive maps
						</p>
					</div>
				</div>

				{/* Storm List */}
				<div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
					<h3 className="mb-4 font-semibold text-white">Recent Storm Reports</h3>
					
					{filteredStorms.length === 0 ? (
						<div className="py-8 text-center text-slate-400">
							<p>No storm reports match your filters.</p>
							<p className="mt-2 text-sm text-slate-500">
								Try adjusting filters or refresh for latest data.
							</p>
						</div>
					) : (
						<div className="max-h-[350px] space-y-2 overflow-y-auto pr-2">
							{Object.entries(stormsByState).map(([state, stateStorms]) => (
								<div key={state} className="space-y-2">
									<p className="sticky top-0 bg-slate-800/90 py-1 text-xs font-semibold text-slate-400 backdrop-blur">
										{state} ({stateStorms.length})
									</p>
									{stateStorms.map((storm) => {
										const colors = SEVERITY_COLORS[storm.severity || "moderate"];
										const isSelected = selectedStorm?.id === storm.id;
										
										return (
											<motion.button
												key={storm.id}
												onClick={() => onStormSelect(storm)}
												whileHover={{ scale: 1.01 }}
												whileTap={{ scale: 0.99 }}
												className={`
													w-full rounded-lg border p-3 text-left transition-all
													${isSelected 
														? "border-brand-500 bg-brand-500/10" 
														: `${colors.border} ${colors.bg} hover:bg-opacity-30`
													}
												`}
											>
												<div className="flex items-start justify-between">
													<div className="flex items-center gap-2">
														<span className="text-lg">
															{EVENT_ICONS[storm.eventType]}
														</span>
														<div>
															<p className="font-medium text-white">
																{storm.city || storm.county || "Unknown Location"}
															</p>
															<p className="text-xs text-slate-400">
																{storm.county && `${storm.county}, `}{storm.state}
															</p>
														</div>
													</div>
													<div className="text-right">
														<span className={`text-xs font-medium uppercase ${colors.text}`}>
															{storm.severity}
														</span>
														<p className="text-xs text-slate-500">
															{storm.eventDate}
														</p>
													</div>
												</div>
												
												{/* Storm Details */}
												<div className="mt-2 flex gap-4 text-xs text-slate-400">
													{storm.hailSizeInches && (
														<span>🧊 {storm.hailSizeInches}" hail</span>
													)}
													{storm.windSpeedMph && (
														<span>💨 {storm.windSpeedMph} mph</span>
													)}
													{storm.eventTime && (
														<span>🕐 {storm.eventTime}</span>
													)}
												</div>

												{isSelected && (
													<motion.div
														initial={{ opacity: 0, height: 0 }}
														animate={{ opacity: 1, height: "auto" }}
														className="mt-3 border-t border-slate-600 pt-3"
													>
														<p className="text-xs text-brand-400">
															✓ Selected — View leads for this storm →
														</p>
													</motion.div>
												)}
											</motion.button>
										);
									})}
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Active Weather Alerts */}
			{alerts.length > 0 && (
				<div className="space-y-3">
					<h3 className="font-semibold text-white">Active Weather Alerts</h3>
					{alerts.slice(0, 5).map((alert) => (
						<div
							key={alert.id}
							className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4"
						>
							<div className="flex items-start gap-3">
								<span className="text-xl">⚠️</span>
								<div>
									<p className="font-semibold text-orange-400">{alert.event}</p>
									<p className="mt-1 text-sm text-orange-200/80">{alert.headline}</p>
									<p className="mt-2 text-xs text-slate-400">
										Areas: {alert.areas.slice(0, 3).join(", ")}
										{alert.areas.length > 3 && ` +${alert.areas.length - 3} more`}
									</p>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
