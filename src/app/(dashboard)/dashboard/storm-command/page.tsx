"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { PageHeader, Card } from "@/components/dashboard";
import { Button } from "@/components/dashboard/Button";
import dynamic from "next/dynamic";

// Dynamically import map to avoid SSR issues
const StormMap = dynamic(() => import("./StormMap"), { 
	ssr: false,
	loading: () => (
		<div className="h-[500px] bg-slate-800 rounded-xl flex items-center justify-center">
			<div className="text-slate-400">Loading map...</div>
		</div>
	)
});

interface WeatherAlert {
	type: string;
	severity: string;
	headline: string;
	description?: string;
	startTime?: string;
	endTime?: string;
}

interface StormData {
	location: {
		name: string;
		state: string;
		key: string;
	};
	current: {
		temperature: number;
		conditions: string;
		humidity: number;
		wind: { speed: number; direction: string };
	} | null;
	alerts: WeatherAlert[];
	alertCount: number;
	stormRisk: {
		hasHailRisk: boolean;
		thunderstormProbability: number;
		severeWeatherActive: boolean;
	};
}

interface ZoneStats {
	totalProperties: number;
	totalEstimatedClaimValue: number;
	avgClaimValue: number;
	opportunity: {
		conservative: number;
		moderate: number;
		optimistic: number;
	};
}

interface Property {
	id: string;
	address: {
		full: string;
		street: string;
		city: string;
		state: string;
		zip: string;
	};
	owner?: { name: string };
	property: {
		apn?: string;
		fips?: string;
		type?: string;
	};
	estimatedRoofAge: number | null;
	estimatedClaim: {
		low: number;
		high: number;
		average: number;
	};
	location: {
		lat: number;
		lng: number;
	};
}

interface SavedZone {
	id: string;
	name: string;
	lat: number;
	lng: number;
	radius: number;
}

export default function StormCommandPage() {
	// State
	const [searchQuery, setSearchQuery] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const [stormData, setStormData] = useState<StormData | null>(null);
	const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
	const [zoneStats, setZoneStats] = useState<ZoneStats | null>(null);
	const [properties, setProperties] = useState<Property[]>([]);
	const [isLoadingProperties, setIsLoadingProperties] = useState(false);
	const [savedZones, setSavedZones] = useState<SavedZone[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"alerts" | "properties" | "zones">("alerts");

	// Load saved zones from localStorage
	useEffect(() => {
		const saved = localStorage.getItem("stormCommand_savedZones");
		if (saved) {
			setSavedZones(JSON.parse(saved));
		}
	}, []);

	// Search for weather data
	const searchLocation = async () => {
		if (!searchQuery.trim()) return;

		setIsSearching(true);
		setError(null);

		try {
			const response = await fetch(`/api/storm-alerts?query=${encodeURIComponent(searchQuery)}`);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to get weather data");
			}

			setStormData(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Search failed");
		} finally {
			setIsSearching(false);
		}
	};

	// Analyze zone for properties
	const analyzeZone = useCallback(async (lat: number, lng: number, radius: number = 1) => {
		setIsLoadingProperties(true);
		setSelectedLocation({ lat, lng });

		try {
			const response = await fetch("/api/properties", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ lat, lng, radius })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to get properties");
			}

			setProperties(data.properties || []);
			setZoneStats(data.statistics || null);
			setActiveTab("properties");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to analyze zone");
		} finally {
			setIsLoadingProperties(false);
		}
	}, []);

	// Save zone
	const saveZone = (name: string) => {
		if (!selectedLocation) return;

		const newZone: SavedZone = {
			id: Date.now().toString(),
			name,
			lat: selectedLocation.lat,
			lng: selectedLocation.lng,
			radius: 1
		};

		const updated = [...savedZones, newZone];
		setSavedZones(updated);
		localStorage.setItem("stormCommand_savedZones", JSON.stringify(updated));
	};

	// Export properties to CSV
	const exportToCSV = () => {
		if (properties.length === 0) return;

		const headers = ["Address", "City", "State", "ZIP", "Owner", "Year Built", "Sq Ft", "Est Value", "Roof Age", "Est Claim"];
		const rows = properties.map(p => [
			p.address.street,
			p.address.city,
			p.address.state,
			p.address.zip,
			p.owner?.name || "N/A",
			p.property?.apn || "N/A",
			p.estimatedRoofAge || "N/A",
			p.estimatedClaim?.average || "N/A"
		]);

		const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `storm-leads-${new Date().toISOString().split("T")[0]}.csv`;
		a.click();
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	};

	return (
		<div className="mx-auto max-w-7xl space-y-6">
			<PageHeader
				kicker="Enterprise Feature"
				title="AI Storm Command Center"
				description="Real-time severe weather tracking with instant property analysis. Deploy crews before competitors."
			/>

			{/* Search & Stats Bar */}
			<div className="grid gap-4 lg:grid-cols-4">
				{/* Search */}
				<Card className="p-4 lg:col-span-2">
					<div className="flex gap-2">
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && searchLocation()}
							placeholder="Enter city, ZIP, or address..."
							className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:border-[#6D5CFF] focus:outline-none"
						/>
						<Button onClick={searchLocation} disabled={isSearching} variant="primary">
							{isSearching ? "..." : "Search"}
						</Button>
					</div>
				</Card>

				{/* Quick Stats */}
				<Card className="p-4 flex items-center gap-4">
					<div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
						<span className="text-2xl">⚡</span>
					</div>
					<div>
						<p className="text-2xl font-bold text-white">{stormData?.alertCount || 0}</p>
						<p className="text-sm text-slate-400">Active Alerts</p>
					</div>
				</Card>

				<Card className="p-4 flex items-center gap-4">
					<div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
						<span className="text-2xl">🏠</span>
					</div>
					<div>
						<p className="text-2xl font-bold text-white">{properties.length}</p>
						<p className="text-sm text-slate-400">Properties Found</p>
					</div>
				</Card>
			</div>

			{/* Error Display */}
			{error && (
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					className="rounded-lg border border-red-500/30 bg-red-500/10 p-4"
				>
					<p className="text-red-400">{error}</p>
				</motion.div>
			)}

			{/* Main Content Grid */}
			<div className="grid gap-6 lg:grid-cols-3">
				{/* Map - Takes 2 columns */}
				<div className="lg:col-span-2 space-y-4">
					<Card className="overflow-hidden">
						<StormMap
							center={selectedLocation || { lat: 39.8283, lng: -98.5795 }}
							zoom={selectedLocation ? 12 : 4}
							onLocationSelect={(lat, lng) => analyzeZone(lat, lng)}
							properties={properties}
							alerts={stormData?.alerts || []}
						/>
					</Card>

					{/* Zone Statistics */}
					{zoneStats && (
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
						>
							<Card className="p-6 bg-gradient-to-br from-[#6D5CFF]/10 to-transparent border-[#6D5CFF]/30">
								<h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
									<span>💰</span> Zone Opportunity Analysis
								</h3>

                    <div className="grid grid-cols-3 gap-4 mb-6">
							<div className="text-center">
								<p className="text-3xl font-bold text-white">{zoneStats.totalProperties}</p>
								<p className="text-sm text-slate-400">Properties</p>
							</div>
							<div className="text-center">
								<p className="text-3xl font-bold text-[#A78BFA]">{formatCurrency(zoneStats.totalEstimatedClaimValue)}</p>
								<p className="text-sm text-slate-400">Total Est. Claims</p>
							</div>
							<div className="text-center">
								<p className="text-3xl font-bold text-emerald-400">{formatCurrency(zoneStats.avgClaimValue)}</p>
								<p className="text-sm text-slate-400">Avg Claim</p>
							</div>
						</div>								<div className="border-t border-slate-700 pt-4">
									<p className="text-sm text-slate-400 mb-3">Estimated Revenue Opportunity</p>
									<div className="grid grid-cols-3 gap-4">
										<div className="rounded-lg bg-slate-800/50 p-3 text-center">
											<p className="text-sm text-slate-400">Conservative (10%)</p>
											<p className="text-xl font-bold text-white">{formatCurrency(zoneStats.opportunity.conservative)}</p>
										</div>
										<div className="rounded-lg bg-[#6D5CFF]/20 p-3 text-center border border-[#6D5CFF]/30">
											<p className="text-sm text-slate-400">Moderate (15%)</p>
											<p className="text-xl font-bold text-[#A78BFA]">{formatCurrency(zoneStats.opportunity.moderate)}</p>
										</div>
										<div className="rounded-lg bg-slate-800/50 p-3 text-center">
											<p className="text-sm text-slate-400">Optimistic (25%)</p>
											<p className="text-xl font-bold text-white">{formatCurrency(zoneStats.opportunity.optimistic)}</p>
										</div>
									</div>
								</div>
							</Card>
						</motion.div>
					)}
				</div>

				{/* Sidebar Panel */}
				<div className="space-y-4">
					{/* Tab Navigation */}
					<Card className="p-2">
						<div className="flex gap-1">
							{[
								{ key: "alerts", label: "Alerts", icon: "⚡" },
								{ key: "properties", label: "Properties", icon: "🏠" },
								{ key: "zones", label: "Saved Zones", icon: "📍" }
							].map((tab) => (
								<button
									key={tab.key}
									onClick={() => setActiveTab(tab.key as any)}
									className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
										activeTab === tab.key
											? "bg-[#6D5CFF] text-white"
											: "text-slate-400 hover:text-white hover:bg-slate-800"
									}`}
								>
									{tab.icon} {tab.label}
								</button>
							))}
						</div>
					</Card>

					{/* Tab Content */}
					<Card className="p-4 max-h-[600px] overflow-y-auto">
						{activeTab === "alerts" && (
							<div className="space-y-3">
								<h3 className="font-semibold text-white flex items-center gap-2">
									⚡ Weather Alerts
									{stormData?.stormRisk?.severeWeatherActive && (
										<span className="animate-pulse h-2 w-2 rounded-full bg-red-500"></span>
									)}
								</h3>

								{stormData?.current && (
									<div className="rounded-lg bg-slate-800/50 p-3 mb-4">
										<p className="text-sm text-slate-400">{stormData.location.name}, {stormData.location.state}</p>
										<p className="text-2xl font-bold text-white">{stormData.current.temperature}°F</p>
										<p className="text-slate-300">{stormData.current.conditions}</p>
									</div>
								)}

								{stormData?.alerts && stormData.alerts.length > 0 ? (
									stormData.alerts.map((alert, i) => (
										<div
											key={i}
											className={`rounded-lg p-3 border ${
												alert.severity === "Extreme" || alert.severity === "Severe"
													? "bg-red-500/10 border-red-500/30"
													: "bg-amber-500/10 border-amber-500/30"
											}`}
										>
											<div className="flex items-start gap-2">
												<span className="text-xl">
													{alert.type?.includes("Tornado") ? "🌪️" :
													 alert.type?.includes("Hail") ? "🧊" :
													 alert.type?.includes("Thunder") ? "⛈️" : "⚠️"}
												</span>
												<div>
													<p className="font-medium text-white">{alert.type}</p>
													<p className="text-sm text-slate-300">{alert.headline}</p>
												</div>
											</div>
										</div>
									))
								) : (
									<div className="text-center py-8 text-slate-500">
										<p className="text-4xl mb-2">☀️</p>
										<p>No active alerts</p>
										<p className="text-sm">Search a location to check weather</p>
									</div>
								)}

								{stormData?.stormRisk?.hasHailRisk && (
									<div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-3 mt-4">
										<p className="font-medium text-cyan-400">🧊 Hail Risk Detected</p>
										<p className="text-sm text-slate-300">This area may experience hail. Consider analyzing for leads.</p>
									</div>
								)}
							</div>
						)}

						{activeTab === "properties" && (
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<h3 className="font-semibold text-white">🏠 Properties ({properties.length})</h3>
									{properties.length > 0 && (
										<Button onClick={exportToCSV} variant="secondary" className="text-xs py-1 px-2">
											Export CSV
										</Button>
									)}
								</div>

								{isLoadingProperties ? (
									<div className="text-center py-8">
										<div className="animate-spin h-8 w-8 border-2 border-[#6D5CFF] border-t-transparent rounded-full mx-auto mb-2"></div>
										<p className="text-slate-400">Analyzing zone...</p>
									</div>
								) : properties.length > 0 ? (
									properties.slice(0, 50).map((property, i) => (
										<div
											key={property.id || i}
											className="rounded-lg bg-slate-800/50 p-3 hover:bg-slate-800 transition-colors cursor-pointer"
										>
											<p className="font-medium text-white text-sm">{property.address.street}</p>
											<p className="text-xs text-slate-400">{property.address.city}, {property.address.state}</p>
											<div className="flex gap-4 mt-2 text-xs">
												<span className="text-slate-300">
													{property.owner?.name || "Owner N/A"}
												</span>
												<span className="text-emerald-400">
													Claim: {formatCurrency(property.estimatedClaim?.average || 0)}
												</span>
											</div>
										</div>
									))
								) : (
									<div className="text-center py-8 text-slate-500">
										<p className="text-4xl mb-2">📍</p>
										<p>Click on the map to analyze a zone</p>
									</div>
								)}
							</div>
						)}

						{activeTab === "zones" && (
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<h3 className="font-semibold text-white">📍 Saved Zones</h3>
									{selectedLocation && (
										<Button
											onClick={() => {
												const name = prompt("Enter zone name:");
												if (name) saveZone(name);
											}}
											variant="primary"
											className="text-xs py-1 px-2"
										>
											+ Save Current
										</Button>
									)}
								</div>

								{savedZones.length > 0 ? (
									savedZones.map((zone) => (
										<div
											key={zone.id}
											className="rounded-lg bg-slate-800/50 p-3 hover:bg-slate-800 transition-colors cursor-pointer"
											onClick={() => analyzeZone(zone.lat, zone.lng, zone.radius)}
										>
											<p className="font-medium text-white">{zone.name}</p>
											<p className="text-xs text-slate-400">
												{zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
											</p>
										</div>
									))
								) : (
									<div className="text-center py-8 text-slate-500">
										<p className="text-4xl mb-2">📍</p>
										<p>No saved zones yet</p>
										<p className="text-sm">Analyze a zone and save it for quick access</p>
									</div>
								)}
							</div>
						)}
					</Card>

					{/* Quick Actions */}
					{properties.length > 0 && (
						<Card className="p-4">
							<h3 className="font-semibold text-white mb-3">Quick Actions</h3>
							<div className="space-y-2">
								<Button variant="primary" className="w-full" onClick={exportToCSV}>
									📥 Export Lead List (CSV)
								</Button>
								<Button 
									variant="secondary" 
									className="w-full"
									onClick={() => {
										const addresses = properties.map(p => p.address.full).join("/");
										window.open(`https://www.google.com/maps/dir/${addresses}`, "_blank");
									}}
								>
									🗺️ Generate Route (Google Maps)
								</Button>
							</div>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}
