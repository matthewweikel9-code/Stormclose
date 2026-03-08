// Route Optimization
// Optimizes door-knocking routes using nearest neighbor algorithm

import { StormLead, StormRoute, RouteStop } from "./types";
import { calculateDistance } from "./weather-client";

interface RoutePoint {
	id: string;
	address: string;
	lat: number;
	lng: number;
	leadId?: string;
	lead?: StormLead;
}

/**
 * Optimize route order using nearest neighbor algorithm
 * Simple but effective for door-knocking routes
 */
export function optimizeRouteOrder(
	stops: RoutePoint[],
	startLat?: number,
	startLng?: number
): RoutePoint[] {
	if (stops.length <= 1) return stops;
	
	const optimized: RoutePoint[] = [];
	const remaining = [...stops];
	
	// Start from provided location or first stop
	let currentLat = startLat ?? stops[0].lat;
	let currentLng = startLng ?? stops[0].lng;
	
	while (remaining.length > 0) {
		// Find nearest unvisited stop
		let nearestIdx = 0;
		let nearestDist = Infinity;
		
		remaining.forEach((stop, idx) => {
			const dist = calculateDistance(currentLat, currentLng, stop.lat, stop.lng);
			if (dist < nearestDist) {
				nearestDist = dist;
				nearestIdx = idx;
			}
		});
		
		// Add nearest to optimized route
		const nearest = remaining.splice(nearestIdx, 1)[0];
		optimized.push(nearest);
		
		// Move to this location
		currentLat = nearest.lat;
		currentLng = nearest.lng;
	}
	
	return optimized;
}

/**
 * Calculate total route distance in miles
 */
export function calculateRouteDistance(stops: RoutePoint[]): number {
	if (stops.length < 2) return 0;
	
	let totalDistance = 0;
	for (let i = 0; i < stops.length - 1; i++) {
		totalDistance += calculateDistance(
			stops[i].lat, stops[i].lng,
			stops[i + 1].lat, stops[i + 1].lng
		);
	}
	
	return Math.round(totalDistance * 10) / 10;
}

/**
 * Estimate route duration (driving + door time)
 */
export function estimateRouteDuration(
	stops: RoutePoint[],
	minutesPerStop: number = 5,
	avgSpeedMph: number = 25
): number {
	const distance = calculateRouteDistance(stops);
	const drivingMinutes = (distance / avgSpeedMph) * 60;
	const stopMinutes = stops.length * minutesPerStop;
	
	return Math.round(drivingMinutes + stopMinutes);
}

/**
 * Convert leads to route points
 */
export function leadsToRoutePoints(leads: StormLead[]): RoutePoint[] {
	return leads
		.filter(lead => lead.latitude && lead.longitude)
		.map(lead => ({
			id: lead.id,
			address: lead.address,
			lat: lead.latitude!,
			lng: lead.longitude!,
			leadId: lead.id,
			lead
		}));
}

/**
 * Create route from selected leads
 */
export function createRouteFromLeads(
	leads: StormLead[],
	userId: string,
	routeName: string,
	stormEventId?: string,
	startLat?: number,
	startLng?: number
): {
	route: Omit<StormRoute, "id" | "createdAt">;
	stops: Omit<RouteStop, "id" | "routeId" | "createdAt">[];
} {
	// Convert to route points
	const points = leadsToRoutePoints(leads);
	
	// Optimize order
	const optimizedPoints = optimizeRouteOrder(points, startLat, startLng);
	
	// Calculate metrics
	const distance = calculateRouteDistance(optimizedPoints);
	const duration = estimateRouteDuration(optimizedPoints);
	
	// Create route object
	const route: Omit<StormRoute, "id" | "createdAt"> = {
		userId,
		stormEventId,
		name: routeName,
		status: "planned",
		totalStops: optimizedPoints.length,
		completedStops: 0,
		estimatedDurationMinutes: duration,
		totalDistanceMiles: distance,
		startAddress: startLat && startLng ? "Custom start" : optimizedPoints[0]?.address,
		startLat: startLat ?? optimizedPoints[0]?.lat,
		startLng: startLng ?? optimizedPoints[0]?.lng
	};
	
	// Create stops
	const stops: Omit<RouteStop, "id" | "routeId" | "createdAt">[] = optimizedPoints.map(
		(point, index) => ({
			leadId: point.leadId,
			stopOrder: index + 1,
			address: point.address,
			latitude: point.lat,
			longitude: point.lng,
			status: "pending" as const
		})
	);
	
	return { route, stops };
}

/**
 * Get route progress statistics
 */
export function getRouteProgress(stops: RouteStop[]): {
	total: number;
	completed: number;
	pending: number;
	skipped: number;
	notHome: number;
	callbacks: number;
	percentComplete: number;
} {
	const total = stops.length;
	const completed = stops.filter(s => s.status === "completed").length;
	const pending = stops.filter(s => s.status === "pending").length;
	const skipped = stops.filter(s => s.status === "skipped").length;
	const notHome = stops.filter(s => s.status === "not_home").length;
	const callbacks = stops.filter(s => s.status === "callback").length;
	
	return {
		total,
		completed,
		pending,
		skipped,
		notHome,
		callbacks,
		percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0
	};
}

/**
 * Get route outcome statistics
 */
export function getRouteOutcomes(stops: RouteStop[]): {
	inspectionsScheduled: number;
	callbacksScheduled: number;
	notInterested: number;
	noAnswer: number;
	sold: number;
	conversionRate: number;
} {
	const completedStops = stops.filter(s => s.status === "completed" || s.outcome);
	const total = completedStops.length;
	
	const inspectionsScheduled = stops.filter(
		s => s.outcome === "inspection_scheduled"
	).length;
	const callbacksScheduled = stops.filter(
		s => s.outcome === "callback_scheduled"
	).length;
	const notInterested = stops.filter(
		s => s.outcome === "not_interested"
	).length;
	const noAnswer = stops.filter(s => s.status === "not_home").length;
	const sold = stops.filter(s => s.outcome === "sold").length;
	
	const positiveOutcomes = inspectionsScheduled + callbacksScheduled + sold;
	const conversionRate = total > 0 ? Math.round((positiveOutcomes / total) * 100) : 0;
	
	return {
		inspectionsScheduled,
		callbacksScheduled,
		notInterested,
		noAnswer,
		sold,
		conversionRate
	};
}

/**
 * Get next stop in route
 */
export function getNextStop(stops: RouteStop[]): RouteStop | null {
	const sortedStops = [...stops].sort((a, b) => a.stopOrder - b.stopOrder);
	return sortedStops.find(s => s.status === "pending") || null;
}

/**
 * Generate turn-by-turn directions URL (Google Maps)
 */
export function generateDirectionsUrl(stops: RoutePoint[]): string {
	if (stops.length === 0) return "";
	
	const waypoints = stops.map(s => `${s.lat},${s.lng}`);
	const origin = waypoints[0];
	const destination = waypoints[waypoints.length - 1];
	const middle = waypoints.slice(1, -1).join("|");
	
	let url = `https://www.google.com/maps/dir/?api=1`;
	url += `&origin=${origin}`;
	url += `&destination=${destination}`;
	
	if (middle) {
		url += `&waypoints=${middle}`;
	}
	
	url += `&travelmode=driving`;
	
	return url;
}
