"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StormLead, StormEvent, LeadTemperature, LeadStatus } from "@/lib/storms/types";

interface StormLeadsProps {
	leads: StormLead[];
	selectedStorm: StormEvent | null;
	onLeadUpdate: (leadId: string, updates: Partial<StormLead>) => void;
	onCreateRoute: (name: string, leadIds: string[]) => void;
	onRefresh: () => void;
}

const TEMPERATURE_STYLES = {
	hot: { bg: "bg-red-500/20", border: "border-red-500/50", text: "text-red-400", icon: "🔥" },
	warm: { bg: "bg-yellow-500/20", border: "border-yellow-500/50", text: "text-yellow-400", icon: "☀️" },
	cold: { bg: "bg-blue-500/20", border: "border-blue-500/50", text: "text-blue-400", icon: "❄️" }
};

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
	{ value: "new", label: "New" },
	{ value: "contacted", label: "Contacted" },
	{ value: "scheduled", label: "Scheduled" },
	{ value: "inspected", label: "Inspected" },
	{ value: "quoted", label: "Quoted" },
	{ value: "sold", label: "Sold" },
	{ value: "lost", label: "Lost" },
	{ value: "not_interested", label: "Not Interested" }
];

export function StormLeads({
	leads,
	selectedStorm,
	onLeadUpdate,
	onCreateRoute,
	onRefresh
}: StormLeadsProps) {
	const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
	const [filterTemp, setFilterTemp] = useState<string>("all");
	const [filterStatus, setFilterStatus] = useState<string>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [showRouteModal, setShowRouteModal] = useState(false);
	const [routeName, setRouteName] = useState("");
	const [expandedLead, setExpandedLead] = useState<string | null>(null);

	// Filter leads
	const filteredLeads = leads.filter(lead => {
		if (filterTemp !== "all" && lead.leadTemperature !== filterTemp) return false;
		if (filterStatus !== "all" && lead.status !== filterStatus) return false;
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			return (
				lead.address.toLowerCase().includes(query) ||
				lead.ownerName?.toLowerCase().includes(query) ||
				lead.city?.toLowerCase().includes(query)
			);
		}
		return true;
	});

	// Stats
	const stats = {
		total: leads.length,
		hot: leads.filter(l => l.leadTemperature === "hot").length,
		warm: leads.filter(l => l.leadTemperature === "warm").length,
		cold: leads.filter(l => l.leadTemperature === "cold").length,
		avgScore: leads.length > 0 
			? Math.round(leads.reduce((sum, l) => sum + (l.leadScore || 0), 0) / leads.length)
			: 0
	};

	// Toggle lead selection
	const toggleLeadSelection = (leadId: string) => {
		const newSelected = new Set(selectedLeads);
		if (newSelected.has(leadId)) {
			newSelected.delete(leadId);
		} else {
			newSelected.add(leadId);
		}
		setSelectedLeads(newSelected);
	};

	// Select all visible
	const selectAllVisible = () => {
		const allIds = new Set(filteredLeads.map(l => l.id));
		setSelectedLeads(allIds);
	};

	// Clear selection
	const clearSelection = () => {
		setSelectedLeads(new Set());
	};

	// Handle route creation
	const handleCreateRoute = () => {
		if (routeName && selectedLeads.size > 0) {
			onCreateRoute(routeName, Array.from(selectedLeads));
			setShowRouteModal(false);
			setRouteName("");
			clearSelection();
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold text-white">
						{selectedStorm 
							? `Leads from ${selectedStorm.city || selectedStorm.county}, ${selectedStorm.state}`
							: "All Leads"
						}
					</h2>
					<p className="text-sm text-slate-400">
						{filteredLeads.length} leads • Avg score: {stats.avgScore}%
					</p>
				</div>
				<div className="flex gap-2">
					{selectedLeads.size > 0 && (
						<button
							onClick={() => setShowRouteModal(true)}
							className="button-primary flex items-center gap-2"
						>
							<span>🗺️</span>
							Create Route ({selectedLeads.size})
						</button>
					)}
					<button onClick={onRefresh} className="button-secondary">
						Refresh
					</button>
				</div>
			</div>

			{/* Stats Bar */}
			<div className="grid grid-cols-4 gap-4">
				<div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-center">
					<p className="text-xl font-bold text-white">{stats.total}</p>
					<p className="text-xs text-slate-400">Total Leads</p>
				</div>
				<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center">
					<p className="text-xl font-bold text-red-400">{stats.hot}</p>
					<p className="text-xs text-red-300/70">🔥 Hot</p>
				</div>
				<div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-center">
					<p className="text-xl font-bold text-yellow-400">{stats.warm}</p>
					<p className="text-xs text-yellow-300/70">☀️ Warm</p>
				</div>
				<div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-center">
					<p className="text-xl font-bold text-blue-400">{stats.cold}</p>
					<p className="text-xs text-blue-300/70">❄️ Cold</p>
				</div>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-4">
				<input
					type="text"
					placeholder="Search address or name..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="flex-1 min-w-[200px] rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white placeholder-slate-400"
				/>
				<select
					value={filterTemp}
					onChange={(e) => setFilterTemp(e.target.value)}
					className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
				>
					<option value="all">All Temperatures</option>
					<option value="hot">🔥 Hot</option>
					<option value="warm">☀️ Warm</option>
					<option value="cold">❄️ Cold</option>
				</select>
				<select
					value={filterStatus}
					onChange={(e) => setFilterStatus(e.target.value)}
					className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
				>
					<option value="all">All Statuses</option>
					{STATUS_OPTIONS.map(opt => (
						<option key={opt.value} value={opt.value}>{opt.label}</option>
					))}
				</select>
				<div className="flex gap-2">
					<button
						onClick={selectAllVisible}
						className="text-sm text-brand-400 hover:text-brand-300"
					>
						Select All
					</button>
					{selectedLeads.size > 0 && (
						<button
							onClick={clearSelection}
							className="text-sm text-slate-400 hover:text-white"
						>
							Clear ({selectedLeads.size})
						</button>
					)}
				</div>
			</div>

			{/* Leads List */}
			{filteredLeads.length === 0 ? (
				<div className="rounded-xl border border-slate-700 bg-slate-800/50 p-12 text-center">
					<div className="text-4xl mb-4">🎯</div>
					<h3 className="text-lg font-semibold text-white">No Leads Yet</h3>
					<p className="mt-2 text-sm text-slate-400">
						Select a storm from the radar to generate leads, or add leads manually.
					</p>
				</div>
			) : (
				<div className="space-y-2">
					{filteredLeads.map((lead) => {
						const tempStyle = TEMPERATURE_STYLES[lead.leadTemperature || "cold"];
						const isSelected = selectedLeads.has(lead.id);
						const isExpanded = expandedLead === lead.id;

						return (
							<motion.div
								key={lead.id}
								layout
								className={`
									rounded-lg border transition-all
									${isSelected 
										? "border-brand-500 bg-brand-500/10" 
										: "border-slate-700 bg-slate-800/50 hover:border-slate-600"
									}
								`}
							>
								{/* Main Row */}
								<div className="flex items-center gap-4 p-4">
									{/* Checkbox */}
									<input
										type="checkbox"
										checked={isSelected}
										onChange={() => toggleLeadSelection(lead.id)}
										className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-brand-500"
									/>

									{/* Temperature Badge */}
									<div className={`rounded-full px-2 py-1 text-xs ${tempStyle.bg} ${tempStyle.text}`}>
										{tempStyle.icon} {lead.leadScore}%
									</div>

									{/* Lead Info */}
									<div className="flex-1 min-w-0">
										<p className="font-medium text-white truncate">{lead.address}</p>
										<p className="text-sm text-slate-400">
											{lead.city}, {lead.state} {lead.zip}
										</p>
									</div>

									{/* Contact Info */}
									<div className="hidden md:block text-right">
										{lead.ownerName && (
											<p className="text-sm text-white">{lead.ownerName}</p>
										)}
										{lead.phone && (
											<p className="text-xs text-slate-400">{lead.phone}</p>
										)}
									</div>

									{/* Status */}
									<select
										value={lead.status}
										onChange={(e) => onLeadUpdate(lead.id, { status: e.target.value as LeadStatus })}
										onClick={(e) => e.stopPropagation()}
										className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white"
									>
										{STATUS_OPTIONS.map(opt => (
											<option key={opt.value} value={opt.value}>{opt.label}</option>
										))}
									</select>

									{/* Expand Button */}
									<button
										onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
										className="text-slate-400 hover:text-white"
									>
										<svg
											className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
										</svg>
									</button>
								</div>

								{/* Expanded Details */}
								<AnimatePresence>
									{isExpanded && (
										<motion.div
											initial={{ height: 0, opacity: 0 }}
											animate={{ height: "auto", opacity: 1 }}
											exit={{ height: 0, opacity: 0 }}
											className="overflow-hidden"
										>
											<div className="border-t border-slate-700 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
												<div>
													<p className="text-xs text-slate-500">Property Value</p>
													<p className="text-sm font-medium text-white">
														{lead.propertyValue 
															? `$${lead.propertyValue.toLocaleString()}`
															: "Unknown"
														}
													</p>
												</div>
												<div>
													<p className="text-xs text-slate-500">Year Built</p>
													<p className="text-sm font-medium text-white">
														{lead.yearBuilt || "Unknown"}
													</p>
												</div>
												<div>
													<p className="text-xs text-slate-500">Damage Probability</p>
													<p className="text-sm font-medium text-emerald-400">
														{lead.damageProbability || 0}%
													</p>
												</div>
												<div>
													<p className="text-xs text-slate-500">Roof Type</p>
													<p className="text-sm font-medium text-white">
														{lead.roofType || "Unknown"}
													</p>
												</div>
											</div>
											<div className="border-t border-slate-700 p-4 flex gap-2">
												{lead.phone && (
													<a
														href={`tel:${lead.phone}`}
														className="button-secondary text-sm flex-1 text-center"
													>
														📞 Call
													</a>
												)}
												<button className="button-secondary text-sm flex-1">
													📧 Email
												</button>
												<button className="button-secondary text-sm flex-1">
													📝 Add Note
												</button>
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</motion.div>
						);
					})}
				</div>
			)}

			{/* Create Route Modal */}
			<AnimatePresence>
				{showRouteModal && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
						onClick={() => setShowRouteModal(false)}
					>
						<motion.div
							initial={{ scale: 0.95 }}
							animate={{ scale: 1 }}
							exit={{ scale: 0.95 }}
							onClick={(e) => e.stopPropagation()}
							className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6"
						>
							<h3 className="text-lg font-semibold text-white">Create Route</h3>
							<p className="mt-1 text-sm text-slate-400">
								{selectedLeads.size} stops selected
							</p>
							
							<input
								type="text"
								placeholder="Route name (e.g., 'Monday AM Route')"
								value={routeName}
								onChange={(e) => setRouteName(e.target.value)}
								className="mt-4 w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white placeholder-slate-400"
							/>
							
							<div className="mt-6 flex gap-3">
								<button
									onClick={() => setShowRouteModal(false)}
									className="button-secondary flex-1"
								>
									Cancel
								</button>
								<button
									onClick={handleCreateRoute}
									disabled={!routeName}
									className="button-primary flex-1"
								>
									Create Route
								</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
