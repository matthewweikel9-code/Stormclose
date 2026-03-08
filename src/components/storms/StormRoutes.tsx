"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StormRoute, RouteStop, StopStatus, StopOutcome } from "@/lib/storms/types";
import { generateDirectionsUrl } from "@/lib/storms/route-optimizer";

interface StormRoutesProps {
	routes: StormRoute[];
	onRefresh: () => void;
}

const STATUS_COLORS = {
	planned: { bg: "bg-slate-500/20", text: "text-slate-400" },
	in_progress: { bg: "bg-blue-500/20", text: "text-blue-400" },
	completed: { bg: "bg-green-500/20", text: "text-green-400" },
	cancelled: { bg: "bg-red-500/20", text: "text-red-400" }
};

const STOP_STATUS_OPTIONS: { value: StopStatus; label: string; icon: string }[] = [
	{ value: "pending", label: "Pending", icon: "⏳" },
	{ value: "completed", label: "Completed", icon: "✅" },
	{ value: "not_home", label: "Not Home", icon: "🚫" },
	{ value: "callback", label: "Callback", icon: "📞" },
	{ value: "skipped", label: "Skipped", icon: "⏭️" }
];

const OUTCOME_OPTIONS: { value: StopOutcome; label: string; icon: string }[] = [
	{ value: "inspection_scheduled", label: "Inspection Scheduled", icon: "📅" },
	{ value: "callback_scheduled", label: "Callback Scheduled", icon: "📞" },
	{ value: "not_interested", label: "Not Interested", icon: "👎" },
	{ value: "already_has_roofer", label: "Has Roofer", icon: "🏠" },
	{ value: "no_damage", label: "No Damage", icon: "✓" },
	{ value: "sold", label: "Sold!", icon: "🎉" }
];

export function StormRoutes({ routes, onRefresh }: StormRoutesProps) {
	const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
	const [activeStop, setActiveStop] = useState<string | null>(null);
	const [filterStatus, setFilterStatus] = useState<string>("all");

	// Filter routes
	const filteredRoutes = routes.filter(route => {
		if (filterStatus !== "all" && route.status !== filterStatus) return false;
		return true;
	});

	// Handle stop update
	const handleStopUpdate = async (routeId: string, stopId: string, updates: Partial<RouteStop>) => {
		try {
			const res = await fetch(`/api/storms/routes/${routeId}/stops/${stopId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(updates)
			});
			
			if (res.ok) {
				onRefresh();
			}
		} catch (error) {
			console.error("Error updating stop:", error);
		}
	};

	// Get Google Maps URL for route
	const getRouteDirectionsUrl = (route: StormRoute) => {
		if (!route.stops || route.stops.length === 0) return "#";
		
		const points = route.stops
			.filter(s => s.latitude && s.longitude)
			.map(s => ({
				id: s.id,
				address: s.address,
				lat: s.latitude!,
				lng: s.longitude!
			}));
		
		return generateDirectionsUrl(points);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold text-white">Storm Routes</h2>
					<p className="text-sm text-slate-400">
						{routes.length} routes • {routes.filter(r => r.status === "in_progress").length} in progress
					</p>
				</div>
				<div className="flex gap-2">
					<select
						value={filterStatus}
						onChange={(e) => setFilterStatus(e.target.value)}
						className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
					>
						<option value="all">All Routes</option>
						<option value="planned">Planned</option>
						<option value="in_progress">In Progress</option>
						<option value="completed">Completed</option>
					</select>
					<button onClick={onRefresh} className="button-secondary">
						Refresh
					</button>
				</div>
			</div>

			{/* Routes List */}
			{filteredRoutes.length === 0 ? (
				<div className="rounded-xl border border-slate-700 bg-slate-800/50 p-12 text-center">
					<div className="text-4xl mb-4">🗺️</div>
					<h3 className="text-lg font-semibold text-white">No Routes Yet</h3>
					<p className="mt-2 text-sm text-slate-400">
						Select leads and create a route to start door knocking.
					</p>
				</div>
			) : (
				<div className="space-y-4">
					{filteredRoutes.map((route) => {
						const statusStyle = STATUS_COLORS[route.status];
						const isExpanded = expandedRoute === route.id;
						const progress = route.totalStops > 0 
							? Math.round((route.completedStops / route.totalStops) * 100) 
							: 0;

						return (
							<motion.div
								key={route.id}
								layout
								className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden"
							>
								{/* Route Header */}
								<div
									className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-800/80"
									onClick={() => setExpandedRoute(isExpanded ? null : route.id)}
								>
									{/* Status Badge */}
									<div className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
										{route.status.replace("_", " ")}
									</div>

									{/* Route Info */}
									<div className="flex-1 min-w-0">
										<p className="font-semibold text-white">{route.name}</p>
										<p className="text-sm text-slate-400">
											{route.totalStops} stops • {route.estimatedDurationMinutes} min • {route.totalDistanceMiles?.toFixed(1)} mi
										</p>
									</div>

									{/* Progress Bar */}
									<div className="hidden md:flex items-center gap-3 w-32">
										<div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
											<div 
												className="h-full bg-brand-500 transition-all"
												style={{ width: `${progress}%` }}
											/>
										</div>
										<span className="text-xs text-slate-400">{progress}%</span>
									</div>

									{/* Actions */}
									<a
										href={getRouteDirectionsUrl(route)}
										target="_blank"
										rel="noopener noreferrer"
										onClick={(e) => e.stopPropagation()}
										className="button-primary text-sm"
									>
										🧭 Navigate
									</a>

									{/* Expand Icon */}
									<svg
										className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
									</svg>
								</div>

								{/* Expanded Stops */}
								<AnimatePresence>
									{isExpanded && route.stops && (
										<motion.div
											initial={{ height: 0 }}
											animate={{ height: "auto" }}
											exit={{ height: 0 }}
											className="overflow-hidden"
										>
											<div className="border-t border-slate-700">
												{route.stops.map((stop, index) => {
													const isActive = activeStop === stop.id;
													const isCompleted = stop.status !== "pending";
													
													return (
														<div
															key={stop.id}
															className={`
																border-b border-slate-700/50 last:border-b-0
																${isCompleted ? "bg-slate-800/30" : "bg-slate-800/50"}
															`}
														>
															{/* Stop Row */}
															<div className="flex items-center gap-4 p-4">
																{/* Stop Number */}
																<div className={`
																	flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold
																	${isCompleted 
																		? "bg-green-500/20 text-green-400" 
																		: "bg-slate-700 text-white"
																	}
																`}>
																	{isCompleted ? "✓" : index + 1}
																</div>

																{/* Stop Info */}
																<div className="flex-1 min-w-0">
																	<p className={`font-medium ${isCompleted ? "text-slate-400 line-through" : "text-white"}`}>
																		{stop.address}
																	</p>
																	{stop.lead && (
																		<p className="text-sm text-slate-400">
																			{stop.lead.ownerName || "Unknown"} 
																			{stop.lead.phone && ` • ${stop.lead.phone}`}
																		</p>
																	)}
																</div>

																{/* Status Dropdown */}
																<select
																	value={stop.status}
																	onChange={(e) => handleStopUpdate(route.id, stop.id, { 
																		status: e.target.value as StopStatus 
																	})}
																	className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white"
																>
																	{STOP_STATUS_OPTIONS.map(opt => (
																		<option key={opt.value} value={opt.value}>
																			{opt.icon} {opt.label}
																		</option>
																	))}
																</select>

																{/* Expand Stop */}
																<button
																	onClick={() => setActiveStop(isActive ? null : stop.id)}
																	className="text-slate-400 hover:text-white"
																>
																	<svg
																		className={`h-4 w-4 transition-transform ${isActive ? "rotate-180" : ""}`}
																		fill="none"
																		viewBox="0 0 24 24"
																		stroke="currentColor"
																	>
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
																	</svg>
																</button>
															</div>

															{/* Stop Details */}
															<AnimatePresence>
																{isActive && (
																	<motion.div
																		initial={{ height: 0, opacity: 0 }}
																		animate={{ height: "auto", opacity: 1 }}
																		exit={{ height: 0, opacity: 0 }}
																		className="overflow-hidden"
																	>
																		<div className="border-t border-slate-700/50 bg-slate-900/50 p-4">
																			<p className="text-xs text-slate-400 mb-3">Log outcome:</p>
																			<div className="flex flex-wrap gap-2">
																				{OUTCOME_OPTIONS.map(opt => (
																					<button
																						key={opt.value}
																						onClick={() => handleStopUpdate(route.id, stop.id, {
																							status: "completed",
																							outcome: opt.value
																						})}
																						className={`
																							rounded-lg border px-3 py-2 text-xs transition-all
																							${stop.outcome === opt.value
																								? "border-brand-500 bg-brand-500/20 text-brand-400"
																								: "border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500"
																							}
																						`}
																					>
																						{opt.icon} {opt.label}
																					</button>
																				))}
																			</div>

																			<div className="mt-4 flex gap-2">
																				<a
																					href={`https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`}
																					target="_blank"
																					rel="noopener noreferrer"
																					className="button-secondary text-xs flex-1"
																				>
																					📍 View on Map
																				</a>
																				{stop.lead?.phone && (
																					<a
																						href={`tel:${stop.lead.phone}`}
																						className="button-secondary text-xs flex-1"
																					>
																						📞 Call
																					</a>
																				)}
																			</div>
																		</div>
																	</motion.div>
																)}
															</AnimatePresence>
														</div>
													);
												})}
											</div>

											{/* Route Summary */}
											<div className="border-t border-slate-700 bg-slate-900/30 p-4">
												<div className="flex items-center justify-between text-sm">
													<div className="flex gap-6">
														<span className="text-slate-400">
															✅ {route.completedStops} completed
														</span>
														<span className="text-slate-400">
															⏳ {route.totalStops - route.completedStops} remaining
														</span>
													</div>
													{route.stormEvent && (
														<span className="text-slate-500">
															Storm: {route.stormEvent.city}, {route.stormEvent.state}
														</span>
													)}
												</div>
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</motion.div>
						);
					})}
				</div>
			)}
		</div>
	);
}
