"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StormRadar } from "./StormRadar";
import { StormLeads } from "./StormLeads";
import { StormRoutes } from "./StormRoutes";
import { StormEvent, StormLead, StormRoute, WeatherAlert } from "@/lib/storms/types";

type Tab = "radar" | "leads" | "routes";

interface StormCommandCenterProps {
	initialTab?: Tab;
}

export function StormCommandCenter({ initialTab = "radar" }: StormCommandCenterProps) {
	const [activeTab, setActiveTab] = useState<Tab>(initialTab);
	const [storms, setStorms] = useState<StormEvent[]>([]);
	const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
	const [leads, setLeads] = useState<StormLead[]>([]);
	const [routes, setRoutes] = useState<StormRoute[]>([]);
	const [selectedStorm, setSelectedStorm] = useState<StormEvent | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [lastUpdated, setLastUpdated] = useState<string | null>(null);

	// Fetch storms
	const fetchStorms = useCallback(async (refresh = false) => {
		try {
			const url = `/api/storms/active${refresh ? "?refresh=true" : ""}`;
			const res = await fetch(url);
			const data = await res.json();
			
			if (data.storms) setStorms(data.storms);
			if (data.alerts) setAlerts(data.alerts);
			if (data.lastUpdated) setLastUpdated(data.lastUpdated);
		} catch (error) {
			console.error("Error fetching storms:", error);
		}
	}, []);

	// Fetch leads
	const fetchLeads = useCallback(async (stormId?: string) => {
		try {
			const url = stormId 
				? `/api/storms/leads?stormId=${stormId}` 
				: "/api/storms/leads";
			const res = await fetch(url);
			const data = await res.json();
			
			if (data.leads) setLeads(data.leads);
		} catch (error) {
			console.error("Error fetching leads:", error);
		}
	}, []);

	// Fetch routes
	const fetchRoutes = useCallback(async () => {
		try {
			const res = await fetch("/api/storms/routes?includeStops=true");
			const data = await res.json();
			
			if (data.routes) setRoutes(data.routes);
		} catch (error) {
			console.error("Error fetching routes:", error);
		}
	}, []);

	// Initial load
	useEffect(() => {
		const loadData = async () => {
			setIsLoading(true);
			await Promise.all([
				fetchStorms(),
				fetchLeads(),
				fetchRoutes()
			]);
			setIsLoading(false);
		};
		loadData();
	}, [fetchStorms, fetchLeads, fetchRoutes]);

	// Handle storm selection
	const handleStormSelect = (storm: StormEvent) => {
		setSelectedStorm(storm);
		fetchLeads(storm.id);
		setActiveTab("leads");
	};

	// Handle lead updates
	const handleLeadUpdate = async (leadId: string, updates: Partial<StormLead>) => {
		try {
			const res = await fetch(`/api/storms/leads/${leadId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(updates)
			});
			
			if (res.ok) {
				await fetchLeads(selectedStorm?.id);
			}
		} catch (error) {
			console.error("Error updating lead:", error);
		}
	};

	// Handle route creation
	const handleCreateRoute = async (name: string, leadIds: string[]) => {
		try {
			const res = await fetch("/api/storms/routes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name,
					leadIds,
					stormEventId: selectedStorm?.id
				})
			});
			
			if (res.ok) {
				await fetchRoutes();
				setActiveTab("routes");
			}
		} catch (error) {
			console.error("Error creating route:", error);
		}
	};

	const tabs = [
		{ id: "radar" as Tab, label: "Live Radar", icon: "🌪️", count: storms.length },
		{ id: "leads" as Tab, label: "Leads", icon: "🎯", count: leads.length },
		{ id: "routes" as Tab, label: "Routes", icon: "🗺️", count: routes.length }
	];

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-white">Storm Command Center</h1>
					<p className="text-sm text-slate-400">
						Track storms, generate leads, build routes
						{lastUpdated && (
							<span className="ml-2 text-slate-500">
								• Updated {new Date(lastUpdated).toLocaleTimeString()}
							</span>
						)}
					</p>
				</div>
				<button
					onClick={() => fetchStorms(true)}
					className="button-secondary flex items-center gap-2"
					disabled={isLoading}
				>
					<svg className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Refresh
				</button>
			</div>

			{/* Active Alerts Banner */}
			{alerts.length > 0 && (
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4"
				>
					<div className="flex items-center gap-3">
						<span className="text-2xl">⚠️</span>
						<div>
							<p className="font-semibold text-orange-400">
								{alerts.length} Active Weather Alert{alerts.length > 1 ? "s" : ""}
							</p>
							<p className="text-sm text-orange-300/80">
								{alerts[0].headline}
							</p>
						</div>
					</div>
				</motion.div>
			)}

			{/* Tab Navigation */}
			<div className="flex gap-2 border-b border-slate-700 pb-2">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActiveTab(tab.id)}
						className={`
							flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all
							${activeTab === tab.id
								? "bg-brand-500/20 text-brand-400"
								: "text-slate-400 hover:bg-slate-800 hover:text-white"
							}
						`}
					>
						<span>{tab.icon}</span>
						<span>{tab.label}</span>
						{tab.count > 0 && (
							<span className={`
								rounded-full px-2 py-0.5 text-xs
								${activeTab === tab.id ? "bg-brand-500/30" : "bg-slate-700"}
							`}>
								{tab.count}
							</span>
						)}
					</button>
				))}
			</div>

			{/* Tab Content */}
			<AnimatePresence mode="wait">
				<motion.div
					key={activeTab}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -10 }}
					transition={{ duration: 0.2 }}
				>
					{activeTab === "radar" && (
						<StormRadar
							storms={storms}
							alerts={alerts}
							onStormSelect={handleStormSelect}
							selectedStorm={selectedStorm}
							isLoading={isLoading}
						/>
					)}

					{activeTab === "leads" && (
						<StormLeads
							leads={leads}
							selectedStorm={selectedStorm}
							onLeadUpdate={handleLeadUpdate}
							onCreateRoute={handleCreateRoute}
							onRefresh={() => fetchLeads(selectedStorm?.id)}
						/>
					)}

					{activeTab === "routes" && (
						<StormRoutes
							routes={routes}
							onRefresh={fetchRoutes}
						/>
					)}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
