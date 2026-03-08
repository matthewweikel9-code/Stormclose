"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, Card } from "@/components/dashboard";
import { Button } from "@/components/dashboard/Button";
import { useRouter } from "next/navigation";

interface AddressPrediction {
	placeId: string;
	description: string;
	mainText: string;
	secondaryText: string;
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
		lat: number | null;
		lng: number | null;
	};
	// Local state
	selected?: boolean;
	status?: "new" | "contacted" | "interested" | "not_home" | "not_interested";
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

export default function LeadsPage() {
	const router = useRouter();
	const [searchAddress, setSearchAddress] = useState("");
	const [searchRadius, setSearchRadius] = useState(0.5);
	const [isLoading, setIsLoading] = useState(false);
	const [properties, setProperties] = useState<Property[]>([]);
	const [zoneStats, setZoneStats] = useState<ZoneStats | null>(null);
	const [error, setError] = useState<string | null>(null);
	
	// Selected property for detail modal
	const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
	
	// Properties selected for route
	const [routeProperties, setRouteProperties] = useState<Property[]>([]);
	
	// Address autocomplete
	const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
	const [showPredictions, setShowPredictions] = useState(false);
	const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	
	// Search coordinates
	const [searchCoords, setSearchCoords] = useState<{ lat: number; lng: number } | null>(null);

	// Fetch address predictions
	useEffect(() => {
		const fetchPredictions = async () => {
			if (searchAddress.length < 3) {
				setPredictions([]);
				return;
			}

			setIsLoadingPredictions(true);
			try {
				const response = await fetch(`/api/places-autocomplete?input=${encodeURIComponent(searchAddress)}`);
				const data = await response.json();
				setPredictions(data.predictions || []);
			} catch {
				console.error("Failed to fetch predictions");
			} finally {
				setIsLoadingPredictions(false);
			}
		};

		const debounce = setTimeout(fetchPredictions, 300);
		return () => clearTimeout(debounce);
	}, [searchAddress]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node) &&
				!inputRef.current?.contains(e.target as Node)
			) {
				setShowPredictions(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const selectPrediction = (prediction: AddressPrediction) => {
		setSearchAddress(prediction.description);
		setPredictions([]);
		setShowPredictions(false);
	};

	// Search for properties
	const handleSearch = async () => {
		if (!searchAddress) return;
		
		setIsLoading(true);
		setError(null);
		setProperties([]);
		setZoneStats(null);
		
		try {
			// Search for properties - geocoding happens server-side
			const response = await fetch("/api/properties", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					address: searchAddress,
					radius: searchRadius,
					pageSize: 100
				})
			});
			
			const data = await response.json();
			
			if (!response.ok) {
				throw new Error(data.error || "Failed to search properties");
			}
			
			if (data.zone?.center) {
				setSearchCoords(data.zone.center);
			}
			
			setProperties(data.properties || []);
			setZoneStats(data.statistics || null);
			
			if (!data.properties || data.properties.length === 0) {
				setError("No properties found in this area. Try a different location or larger radius.");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to search properties");
		} finally {
			setIsLoading(false);
		}
	};

	// Calculate success score based on property data
	const getSuccessScore = (property: Property): { score: number; label: string; color: string } => {
		let score = 50; // Base score
		
		// Roof age factor (older = higher score)
		if (property.estimatedRoofAge) {
			if (property.estimatedRoofAge >= 20) score += 30;
			else if (property.estimatedRoofAge >= 15) score += 20;
			else if (property.estimatedRoofAge >= 10) score += 10;
		}
		
		// Higher claim value = more potential
		if (property.estimatedClaim?.average) {
			if (property.estimatedClaim.average >= 15000) score += 15;
			else if (property.estimatedClaim.average >= 10000) score += 10;
		}
		
		// Owner name available
		if (property.owner?.name && property.owner.name !== "Unknown") {
			score += 5;
		}
		
		// Cap at 100
		score = Math.min(100, score);
		
		if (score >= 80) return { score, label: "Hot", color: "text-red-400 bg-red-500/20" };
		if (score >= 60) return { score, label: "Warm", color: "text-amber-400 bg-amber-500/20" };
		return { score, label: "Cool", color: "text-blue-400 bg-blue-500/20" };
	};

	// Toggle property selection for route
	const toggleRouteSelection = (property: Property) => {
		const exists = routeProperties.find(p => p.id === property.id);
		if (exists) {
			setRouteProperties(routeProperties.filter(p => p.id !== property.id));
		} else {
			setRouteProperties([...routeProperties, property]);
		}
	};

	// Format currency
	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(value);
	};

	// Navigate to roof measurement with address pre-filled
	const importToRoofMeasurement = (property: Property) => {
		const address = encodeURIComponent(property.address.full);
		router.push(`/dashboard/roof-measure?address=${address}`);
	};

	// Go to route planner with selected properties
	const goToRoutePlanner = () => {
		// Store selected properties in sessionStorage for route planner
		sessionStorage.setItem("routeProperties", JSON.stringify(routeProperties));
		router.push("/dashboard/route-planner");
	};

	// Export leads to CSV
	const exportToCSV = () => {
		if (properties.length === 0) return;
		
		const headers = ["Address", "City", "State", "ZIP", "Owner", "Est Claim", "Success Score"];
		const rows = properties.map(p => {
			const score = getSuccessScore(p);
			return [
				p.address.street,
				p.address.city,
				p.address.state,
				p.address.zip,
				p.owner?.name || "N/A",
				p.estimatedClaim?.average || 0,
				`${score.score}% (${score.label})`
			].join(",");
		});
		
		const csv = [headers.join(","), ...rows].join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
		a.click();
	};

	return (
		<div className="space-y-6">
			<PageHeader
				title="Lead Generator"
				description="Search properties by area and find high-potential roofing leads"
			/>

			{/* Search Section */}
			<Card className="p-6 bg-slate-800/50 border-slate-700">
				<div className="flex flex-col md:flex-row gap-4">
					{/* Address Search with Autocomplete */}
					<div className="flex-1 relative">
						<label className="block text-sm font-medium text-slate-300 mb-2">
							Search Location
						</label>
						<input
							ref={inputRef}
							type="text"
							value={searchAddress}
							onChange={(e) => {
								setSearchAddress(e.target.value);
								setShowPredictions(true);
							}}
							onFocus={() => setShowPredictions(true)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									setShowPredictions(false);
									handleSearch();
								}
							}}
							placeholder="Enter address, city, or zip code (e.g., 75001 or Dallas, TX)..."
							className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D5CFF] focus:border-transparent"
						/>
						
						{/* Predictions Dropdown */}
						{showPredictions && predictions.length > 0 && (
							<div
								ref={dropdownRef}
								className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden"
							>
								{predictions.map((prediction) => (
									<button
										key={prediction.placeId}
										onClick={() => selectPrediction(prediction)}
										className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0"
									>
										<p className="text-white font-medium">{prediction.mainText}</p>
										<p className="text-slate-400 text-sm">{prediction.secondaryText}</p>
									</button>
								))}
							</div>
						)}
						
						{isLoadingPredictions && (
							<div className="absolute right-3 top-[42px]">
								<div className="w-5 h-5 border-2 border-[#6D5CFF] border-t-transparent rounded-full animate-spin" />
							</div>
						)}
					</div>
					
					{/* Radius Selector */}
					<div className="w-full md:w-48">
						<label className="block text-sm font-medium text-slate-300 mb-2">
							Search Radius
						</label>
						<select
							value={searchRadius}
							onChange={(e) => setSearchRadius(parseFloat(e.target.value))}
							className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#6D5CFF]"
						>
							<option value={0.25}>0.25 miles</option>
							<option value={0.5}>0.5 miles</option>
							<option value={1}>1 mile</option>
							<option value={2}>2 miles</option>
							<option value={5}>5 miles</option>
						</select>
					</div>
					
					{/* Search Button */}
					<div className="flex items-end">
						<Button
							onClick={handleSearch}
							disabled={isLoading || !searchAddress}
							className="w-full md:w-auto px-8 py-3"
						>
							{isLoading ? (
								<div className="flex items-center gap-2">
									<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
									Searching...
								</div>
							) : (
								<div className="flex items-center gap-2">
									<span>🔍</span> Search Leads
								</div>
							)}
						</Button>
					</div>
				</div>
				
				{error && (
					<div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
						{error}
					</div>
				)}
			</Card>

			{/* Stats Summary */}
			{zoneStats && (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
				>
					<Card className="p-6 bg-gradient-to-br from-[#6D5CFF]/10 to-transparent border-[#6D5CFF]/30">
						<h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
							<span>📊</span> Search Results Summary
						</h3>

						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
							<div className="text-center">
								<p className="text-3xl font-bold text-white">{zoneStats.totalProperties}</p>
								<p className="text-sm text-slate-400">Properties Found</p>
							</div>
							<div className="text-center">
								<p className="text-3xl font-bold text-[#A78BFA]">{formatCurrency(zoneStats.totalEstimatedClaimValue)}</p>
								<p className="text-sm text-slate-400">Total Est. Claims</p>
							</div>
							<div className="text-center">
								<p className="text-3xl font-bold text-emerald-400">{formatCurrency(zoneStats.avgClaimValue)}</p>
								<p className="text-sm text-slate-400">Avg Claim Value</p>
							</div>
							<div className="text-center">
								<p className="text-3xl font-bold text-amber-400">{routeProperties.length}</p>
								<p className="text-sm text-slate-400">Added to Route</p>
							</div>
						</div>

						<div className="border-t border-slate-700 pt-4">
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

			{/* Action Bar */}
			{properties.length > 0 && (
				<div className="flex flex-wrap gap-3">
					<Button
						onClick={goToRoutePlanner}
						disabled={routeProperties.length === 0}
						className="flex items-center gap-2"
					>
						<span>🗺️</span> Plan Route ({routeProperties.length})
					</Button>
					<Button
						onClick={exportToCSV}
						variant="secondary"
						className="flex items-center gap-2"
					>
						<span>📥</span> Export CSV
					</Button>
					<Button
						onClick={() => setRouteProperties(properties)}
						variant="secondary"
						className="flex items-center gap-2"
					>
						<span>✅</span> Select All
					</Button>
					<Button
						onClick={() => setRouteProperties([])}
						variant="secondary"
						className="flex items-center gap-2"
					>
						<span>❌</span> Clear Selection
					</Button>
				</div>
			)}

			{/* Property List */}
			{properties.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{properties.map((property) => {
						const score = getSuccessScore(property);
						const isSelected = routeProperties.some(p => p.id === property.id);
						
						return (
							<motion.div
								key={property.id}
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								whileHover={{ scale: 1.02 }}
								className={`relative cursor-pointer ${isSelected ? "ring-2 ring-[#6D5CFF]" : ""}`}
							>
								<Card className="p-4 bg-slate-800/50 border-slate-700 hover:border-[#6D5CFF]/50 transition-colors h-full">
									{/* Selection Checkbox */}
									<div className="absolute top-3 right-3">
										<button
											onClick={(e) => {
												e.stopPropagation();
												toggleRouteSelection(property);
											}}
											className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
												isSelected 
													? "bg-[#6D5CFF] border-[#6D5CFF] text-white" 
													: "border-slate-500 hover:border-[#6D5CFF]"
											}`}
										>
											{isSelected && "✓"}
										</button>
									</div>
									
									{/* Property Content */}
									<div onClick={() => setSelectedProperty(property)}>
										{/* Success Score Badge */}
										<div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${score.color} mb-3`}>
											<span>{score.label}</span>
											<span className="opacity-70">• {score.score}%</span>
										</div>
										
										{/* Address */}
										<h4 className="text-white font-semibold mb-1 pr-8">{property.address.street}</h4>
										<p className="text-slate-400 text-sm mb-3">
											{property.address.city}, {property.address.state} {property.address.zip}
										</p>
										
										{/* Details Grid */}
										<div className="grid grid-cols-2 gap-2 text-sm">
											<div>
												<span className="text-slate-500">Owner:</span>
												<p className="text-slate-300">{property.owner?.name || "N/A"}</p>
											</div>
											<div>
												<span className="text-slate-500">Est. Claim:</span>
												<p className="text-emerald-400 font-semibold">
													{formatCurrency(property.estimatedClaim?.average || 0)}
												</p>
											</div>
										</div>
										
										{/* Quick Actions */}
										<div className="flex gap-2 mt-4">
											<button
												onClick={(e) => {
													e.stopPropagation();
													setSelectedProperty(property);
												}}
												className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
											>
												👁️ View
											</button>
											<button
												onClick={(e) => {
													e.stopPropagation();
													importToRoofMeasurement(property);
												}}
												className="flex-1 px-3 py-2 bg-[#6D5CFF]/20 hover:bg-[#6D5CFF]/30 border border-[#6D5CFF]/50 rounded-lg text-sm text-[#A78BFA] transition-colors"
											>
												📐 Measure
											</button>
										</div>
									</div>
								</Card>
							</motion.div>
						);
					})}
				</div>
			)}

			{/* Empty State */}
			{!isLoading && properties.length === 0 && !error && (
				<Card className="p-12 bg-slate-800/30 border-slate-700 text-center">
					<div className="text-6xl mb-4">🔍</div>
					<h3 className="text-xl font-semibold text-white mb-2">Search for Leads</h3>
					<p className="text-slate-400 max-w-md mx-auto">
						Enter an address, city, or zip code to find properties in that area. 
						Filter by radius and view detailed property information.
					</p>
				</Card>
			)}

			{/* Property Detail Modal */}
			<AnimatePresence>
				{selectedProperty && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
						onClick={() => setSelectedProperty(null)}
					>
						<motion.div
							initial={{ scale: 0.9, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.9, opacity: 0 }}
							className="bg-slate-800 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
							onClick={(e) => e.stopPropagation()}
						>
							{/* Modal Header */}
							<div className="p-6 border-b border-slate-700">
								<div className="flex items-start justify-between">
									<div>
										<div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getSuccessScore(selectedProperty).color} mb-2`}>
											<span>{getSuccessScore(selectedProperty).label} Lead</span>
											<span className="opacity-70">• {getSuccessScore(selectedProperty).score}%</span>
										</div>
										<h2 className="text-2xl font-bold text-white">{selectedProperty.address.street}</h2>
										<p className="text-slate-400">
											{selectedProperty.address.city}, {selectedProperty.address.state} {selectedProperty.address.zip}
										</p>
									</div>
									<button
										onClick={() => setSelectedProperty(null)}
										className="text-slate-400 hover:text-white text-2xl"
									>
										×
									</button>
								</div>
							</div>
							
							{/* Modal Content */}
							<div className="p-6 space-y-6">
								{/* Google Maps Embed */}
								<div className="aspect-video rounded-lg overflow-hidden bg-slate-900">
									<iframe
										width="100%"
										height="100%"
										style={{ border: 0 }}
										loading="lazy"
										allowFullScreen
										referrerPolicy="no-referrer-when-downgrade"
										src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyB4EuYOLXgQ0sd9AYlx0bJ709VcNLi9HyI&q=${encodeURIComponent(selectedProperty.address.full)}&maptype=satellite`}
									/>
								</div>
								
								{/* Property Details */}
								<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
									<div className="bg-slate-700/50 rounded-lg p-4 text-center">
										<p className="text-slate-400 text-sm">Owner</p>
										<p className="text-white font-semibold">{selectedProperty.owner?.name || "N/A"}</p>
									</div>
									<div className="bg-slate-700/50 rounded-lg p-4 text-center">
										<p className="text-slate-400 text-sm">Est. Claim</p>
										<p className="text-emerald-400 font-semibold text-xl">
											{formatCurrency(selectedProperty.estimatedClaim?.average || 0)}
										</p>
									</div>
									<div className="bg-slate-700/50 rounded-lg p-4 text-center">
										<p className="text-slate-400 text-sm">Claim Range</p>
										<p className="text-white font-semibold">
											{formatCurrency(selectedProperty.estimatedClaim?.low || 0)} - {formatCurrency(selectedProperty.estimatedClaim?.high || 0)}
										</p>
									</div>
									<div className="bg-slate-700/50 rounded-lg p-4 text-center">
										<p className="text-slate-400 text-sm">APN</p>
										<p className="text-white font-semibold">{selectedProperty.property.apn || "N/A"}</p>
									</div>
								</div>
								
								{/* Action Buttons */}
								<div className="flex flex-wrap gap-3">
									<Button
										onClick={() => importToRoofMeasurement(selectedProperty)}
										className="flex items-center gap-2"
									>
										<span>📐</span> Import to Roof Measurement
									</Button>
									<Button
										onClick={() => {
											toggleRouteSelection(selectedProperty);
											setSelectedProperty(null);
										}}
										variant={routeProperties.some(p => p.id === selectedProperty.id) ? "secondary" : "primary"}
										className="flex items-center gap-2"
									>
										{routeProperties.some(p => p.id === selectedProperty.id) ? (
											<><span>✓</span> Added to Route</>
										) : (
											<><span>➕</span> Add to Route</>
										)}
									</Button>
									<Button
										onClick={() => {
											window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedProperty.address.full)}`, "_blank");
										}}
										variant="secondary"
										className="flex items-center gap-2"
									>
										<span>🗺️</span> Open in Google Maps
									</Button>
								</div>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
