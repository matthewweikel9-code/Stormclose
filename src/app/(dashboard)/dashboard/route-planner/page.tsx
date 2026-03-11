"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { PageHeader, Card } from "@/components/dashboard";
import { Button } from "@/components/dashboard/Button";
import { useRouter } from "next/navigation";
import { Cloud, Sun, CloudRain, Wind, Thermometer, Clock, AlertTriangle, CheckCircle } from "lucide-react";

interface WeatherData {
	temperature: number;
	feels_like: number;
	humidity: number;
	wind_speed: number;
	wind_direction: string;
	conditions: string;
	conditions_icon: string;
	precipitation_chance: number;
	hourly_forecast: Array<{
		hour: number;
		temperature: number;
		conditions: string;
		precipitation_chance: number;
	}>;
}

interface RoutingRecommendations {
	can_canvas: boolean;
	optimal_hours: number[];
	warnings: string[];
	tips: string[];
}

interface Property {
	id: string;
	address: string;
	city: string;
	state: string;
	zip: string;
	owner: string;
	estimatedProfit: number;
	estimatedValue: number;
	leadScore: number;
	coordinates: {
		lat: number | null;
		lng: number | null;
	};
	status?: "pending" | "visited" | "interested" | "not_home" | "not_interested";
}

interface RouteInfo {
	totalDistance: string;
	totalDuration: string;
	legs: {
		distance: string;
		duration: string;
		startAddress: string;
		endAddress: string;
	}[];
}

export default function RoutePlannerPage() {
	const router = useRouter();
	const [properties, setProperties] = useState<Property[]>([]);
	const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
	const [isOptimizing, setIsOptimizing] = useState(false);
	const [isOptimized, setIsOptimized] = useState(false);
	const [startingPoint, setStartingPoint] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [weather, setWeather] = useState<WeatherData | null>(null);
	const [routingRecs, setRoutingRecs] = useState<RoutingRecommendations | null>(null);
	const [weatherLoading, setWeatherLoading] = useState(true);

	// Fetch weather data
	const fetchWeather = useCallback(async (lat?: number, lng?: number) => {
		try {
			setWeatherLoading(true);
			const url = lat && lng 
				? `/api/weather?lat=${lat}&lng=${lng}`
				: '/api/weather';
			const res = await fetch(url);
			if (res.ok) {
				const data = await res.json();
				setWeather(data.weather);
				setRoutingRecs(data.routing_recommendations);
			}
		} catch (error) {
			console.error('Error fetching weather:', error);
		} finally {
			setWeatherLoading(false);
		}
	}, []);

	// Get user location and fetch weather
	useEffect(() => {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					fetchWeather(position.coords.latitude, position.coords.longitude);
				},
				() => {
					// Fallback without location
					fetchWeather();
				}
			);
		} else {
			fetchWeather();
		}
	}, [fetchWeather]);

	// Load properties from localStorage on mount (from Lead Generator)
	useEffect(() => {
		const stored = localStorage.getItem("routeList");
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				setProperties(parsed.map((p: Property) => ({ ...p, status: p.status || "pending" })));
			} catch {
				console.error("Failed to parse stored properties");
			}
		}
	}, []);

	// Save properties back to localStorage when changed
	useEffect(() => {
		if (properties.length > 0) {
			localStorage.setItem("routeList", JSON.stringify(properties));
		}
	}, [properties]);

	// Get full address string
	const getFullAddress = (p: Property) => {
		return `${p.address}, ${p.city}, ${p.state} ${p.zip}`;
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

	// Calculate totals
	const totalProfit = properties.reduce(
		(sum, p) => sum + (p.estimatedProfit || 0), 0
	);

	// Remove property from route
	const removeProperty = (id: string) => {
		setProperties(properties.filter(p => p.id !== id));
		setIsOptimized(false);
		setRouteInfo(null);
	};

	// Reorder properties (drag and drop would be nice, but keeping it simple)
	const moveProperty = (index: number, direction: "up" | "down") => {
		if (
			(direction === "up" && index === 0) ||
			(direction === "down" && index === properties.length - 1)
		) {
			return;
		}

		const newProperties = [...properties];
		const newIndex = direction === "up" ? index - 1 : index + 1;
		[newProperties[index], newProperties[newIndex]] = [newProperties[newIndex], newProperties[index]];
		setProperties(newProperties);
		setIsOptimized(false);
	};

	// Optimize route using Google Directions API
	const optimizeRoute = async () => {
		if (properties.length < 2) {
			setError("Add at least 2 properties to optimize a route");
			return;
		}

		setIsOptimizing(true);
		setError(null);

		try {
			const response = await fetch("/api/route-optimize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					startingPoint: startingPoint || getFullAddress(properties[0]),
					waypoints: properties.map(p => getFullAddress(p)),
					optimizeWaypoints: true
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to optimize route");
			}

			// Reorder properties based on optimized order
			if (data.waypointOrder) {
				const reordered = data.waypointOrder.map((index: number) => properties[index]);
				setProperties(reordered);
			}

			setRouteInfo(data.routeInfo);
			setIsOptimized(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to optimize route");
		} finally {
			setIsOptimizing(false);
		}
	};

	// Start navigation - opens Google Maps with the route
	const startNavigation = () => {
		if (properties.length === 0) return;

		// Build Google Maps URL with waypoints
		const origin = startingPoint || getFullAddress(properties[0]);
		const destination = getFullAddress(properties[properties.length - 1]);
		const waypoints = properties.slice(0, -1).map(p => encodeURIComponent(getFullAddress(p))).join("|");

		const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${waypoints}` : ""}&travelmode=driving`;

		window.open(url, "_blank");
	};

	// Update property status
	const updateStatus = (id: string, status: Property["status"]) => {
		setProperties(properties.map(p => 
			p.id === id ? { ...p, status } : p
		));
	};

	// Get status badge style
	const getStatusStyle = (status: Property["status"]) => {
		switch (status) {
			case "visited":
				return "bg-blue-500/20 text-blue-400";
			case "interested":
				return "bg-emerald-500/20 text-emerald-400";
			case "not_home":
				return "bg-amber-500/20 text-amber-400";
			case "not_interested":
				return "bg-red-500/20 text-red-400";
			default:
				return "bg-slate-500/20 text-slate-400";
		}
	};

	return (
		<div className="space-y-6">
			<PageHeader
				title="Route Planner"
				description="Weather-aware routing for maximum efficiency"
			/>

			{/* Weather Banner */}
			{weather && (
				<Card className={`p-4 border ${
					routingRecs?.can_canvas 
						? 'bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/30' 
						: 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30'
				}`}>
					<div className="flex flex-col md:flex-row md:items-center gap-4">
						{/* Current Weather */}
						<div className="flex items-center gap-4">
							<div className="text-4xl">
								{weather.conditions?.toLowerCase().includes('rain') ? '🌧️' : 
								 weather.conditions?.toLowerCase().includes('cloud') ? '☁️' : 
								 weather.conditions?.toLowerCase().includes('snow') ? '❄️' : '☀️'}
							</div>
							<div>
								<div className="flex items-center gap-2">
									<span className="text-2xl font-bold text-white">{weather.temperature}°F</span>
									<span className="text-slate-400">| Feels like {weather.feels_like}°F</span>
								</div>
								<div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
									<span className="flex items-center gap-1">
										<Wind className="h-4 w-4" />
										{weather.wind_speed} mph {weather.wind_direction}
									</span>
									<span className="flex items-center gap-1">
										<CloudRain className="h-4 w-4" />
										{weather.precipitation_chance}% rain
									</span>
								</div>
							</div>
						</div>

						{/* Divider */}
						<div className="hidden md:block w-px h-12 bg-slate-700" />

						{/* Routing Recommendations */}
						<div className="flex-1">
							{routingRecs?.can_canvas ? (
								<div className="flex items-start gap-2">
									<CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
									<div>
										<p className="font-medium text-emerald-400">Great conditions for canvassing!</p>
										{routingRecs.optimal_hours.length > 0 && (
											<p className="text-sm text-slate-400">
												Optimal hours: {routingRecs.optimal_hours.map(h => 
													h > 12 ? `${h-12}pm` : h === 12 ? '12pm' : `${h}am`
												).join(', ')}
											</p>
										)}
									</div>
								</div>
							) : (
								<div className="flex items-start gap-2">
									<AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
									<div>
										<p className="font-medium text-amber-400">Weather Advisory</p>
										<p className="text-sm text-slate-400">
											{routingRecs?.warnings[0] || 'Check conditions before heading out'}
										</p>
									</div>
								</div>
							)}
						</div>

						{/* Hourly Preview */}
						<div className="flex gap-2">
							{weather.hourly_forecast?.slice(0, 4).map((hour, i) => (
								<div key={i} className="text-center px-3 py-2 bg-slate-800/50 rounded-lg">
									<p className="text-xs text-slate-400">
										{hour.hour > 12 ? `${hour.hour-12}pm` : hour.hour === 12 ? '12pm' : `${hour.hour}am`}
									</p>
									<p className="text-sm font-medium text-white">{hour.temperature}°</p>
									<p className="text-xs text-slate-500">{hour.precipitation_chance}%</p>
								</div>
							))}
						</div>
					</div>

					{/* Tips */}
					{routingRecs?.tips && routingRecs.tips.length > 0 && (
						<div className="mt-3 pt-3 border-t border-slate-700/50">
							<div className="flex flex-wrap gap-2">
								{routingRecs.tips.map((tip, i) => (
									<span key={i} className="px-2 py-1 bg-slate-800/50 rounded text-xs text-slate-300">
										💡 {tip}
									</span>
								))}
							</div>
						</div>
					)}
				</Card>
			)}

			{/* Route Summary */}
			<Card className="p-6 bg-gradient-to-br from-[#6D5CFF]/10 to-transparent border-[#6D5CFF]/30">
				<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
					<div className="text-center">
						<p className="text-3xl font-bold text-white">{properties.length}</p>
						<p className="text-sm text-slate-400">Stops</p>
					</div>
					<div className="text-center">
						<p className="text-3xl font-bold text-emerald-400">{formatCurrency(totalProfit)}</p>
						<p className="text-sm text-slate-400">Total Est. Profit</p>
					</div>
					<div className="text-center">
						<p className="text-3xl font-bold text-[#A78BFA]">
							{routeInfo?.totalDistance || "—"}
						</p>
						<p className="text-sm text-slate-400">Total Distance</p>
					</div>
					<div className="text-center">
						<p className="text-3xl font-bold text-amber-400">
							{routeInfo?.totalDuration || "—"}
						</p>
						<p className="text-sm text-slate-400">Est. Drive Time</p>
					</div>
					<div className="text-center">
						<p className="text-3xl font-bold text-white">
							{properties.filter(p => p.status === "interested").length}
						</p>
						<p className="text-sm text-slate-400">Interested</p>
					</div>
				</div>
			</Card>

			{/* Starting Point & Actions */}
			<Card className="p-6 bg-slate-800/50 border-slate-700">
				<div className="flex flex-col md:flex-row gap-4">
					<div className="flex-1">
						<label className="block text-sm font-medium text-slate-300 mb-2">
							Starting Point (Optional)
						</label>
						<input
							type="text"
							value={startingPoint}
							onChange={(e) => setStartingPoint(e.target.value)}
							placeholder="Your office address or current location..."
							className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D5CFF]"
						/>
					</div>
					<div className="flex items-end gap-3">
						<Button
							onClick={optimizeRoute}
							disabled={isOptimizing || properties.length < 2}
							className="flex items-center gap-2"
						>
							{isOptimizing ? (
								<>
									<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
									Optimizing...
								</>
							) : (
								<>
									<span>🧭</span> Optimize Route
								</>
							)}
						</Button>
						<Button
							onClick={startNavigation}
							disabled={properties.length === 0}
							variant="secondary"
							className="flex items-center gap-2"
						>
							<span>🚗</span> Start Navigation
						</Button>
					</div>
				</div>

				{isOptimized && (
					<div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-300 flex items-center gap-2">
						<span>✓</span> Route optimized for shortest travel time!
					</div>
				)}

				{error && (
					<div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
						{error}
					</div>
				)}
			</Card>

			{/* Route Map Preview */}
			{properties.length > 0 && (
				<Card className="overflow-hidden border-slate-700">
					<div className="aspect-[2/1] bg-slate-900">
						<iframe
							width="100%"
							height="100%"
							style={{ border: 0 }}
							loading="lazy"
							allowFullScreen
							referrerPolicy="no-referrer-when-downgrade"
							src={`https://www.google.com/maps/embed/v1/directions?key=AIzaSyB4EuYOLXgQ0sd9AYlx0bJ709VcNLi9HyI&origin=${encodeURIComponent(startingPoint || getFullAddress(properties[0]))}&destination=${encodeURIComponent(getFullAddress(properties[properties.length - 1]))}${properties.length > 2 ? `&waypoints=${properties.slice(1, -1).map(p => encodeURIComponent(getFullAddress(p))).join("|")}` : ""}&mode=driving`}
						/>
					</div>
				</Card>
			)}

			{/* Stop List */}
			{properties.length > 0 ? (
				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-white flex items-center gap-2">
						<span>📍</span> Route Stops
					</h3>
					
					{properties.map((property, index) => (
						<motion.div
							key={property.id}
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: index * 0.05 }}
						>
							<Card className="p-4 bg-slate-800/50 border-slate-700">
								<div className="flex items-center gap-4">
									{/* Stop Number */}
									<div className="w-10 h-10 rounded-full bg-[#6D5CFF] flex items-center justify-center text-white font-bold shrink-0">
										{index + 1}
									</div>
									
									{/* Property Info */}
									<div className="flex-1 min-w-0">
										<h4 className="text-white font-semibold truncate">{property.address}</h4>
										<p className="text-slate-400 text-sm">
											{property.city}, {property.state} {property.zip}
										</p>
										<div className="flex items-center gap-3 mt-1">
											<span className="text-slate-500 text-sm">
												Owner: {property.owner || "N/A"}
											</span>
											<span className="text-emerald-400 text-sm font-medium">
												Est. Profit: {formatCurrency(property.estimatedProfit || 0)}
											</span>
										</div>
									</div>
									
									{/* Leg Info (if route is optimized) */}
									{routeInfo?.legs[index] && index < properties.length - 1 && (
										<div className="hidden md:block text-center px-4 border-l border-slate-700">
											<p className="text-white font-medium">{routeInfo.legs[index].duration}</p>
											<p className="text-slate-400 text-sm">{routeInfo.legs[index].distance}</p>
										</div>
									)}
									
									{/* Status Selector */}
									<select
										value={property.status || "pending"}
										onChange={(e) => updateStatus(property.id, e.target.value as Property["status"])}
										className={`px-3 py-2 rounded-lg border-none text-sm font-medium ${getStatusStyle(property.status)}`}
									>
										<option value="pending">Pending</option>
										<option value="visited">Visited</option>
										<option value="interested">Interested</option>
										<option value="not_home">Not Home</option>
										<option value="not_interested">Not Interested</option>
									</select>
									
									{/* Reorder & Remove */}
									<div className="flex items-center gap-1">
										<button
											onClick={() => moveProperty(index, "up")}
											disabled={index === 0}
											className="p-2 text-slate-400 hover:text-white disabled:opacity-30"
										>
											↑
										</button>
										<button
											onClick={() => moveProperty(index, "down")}
											disabled={index === properties.length - 1}
											className="p-2 text-slate-400 hover:text-white disabled:opacity-30"
										>
											↓
										</button>
										<button
											onClick={() => removeProperty(property.id)}
											className="p-2 text-red-400 hover:text-red-300"
										>
											×
										</button>
									</div>
								</div>
							</Card>
						</motion.div>
					))}
				</div>
			) : (
				<Card className="p-12 bg-slate-800/30 border-slate-700 text-center">
					<div className="text-6xl mb-4">🗺️</div>
					<h3 className="text-xl font-semibold text-white mb-2">No Stops Added</h3>
					<p className="text-slate-400 max-w-md mx-auto mb-6">
						Go to Lead Generator to search for properties and add them to your route.
					</p>
					<Button onClick={() => router.push("/dashboard/leads")}>
						<span>🔍</span> Search for Leads
					</Button>
				</Card>
			)}
		</div>
	);
}
