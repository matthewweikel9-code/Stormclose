// NOAA Weather API Client
// Fetches storm reports from NOAA Storm Prediction Center

import { StormEvent, NOAAStormReport, WeatherAlert, StormSeverity, StormEventType } from "./types";

const NOAA_SPC_BASE = "https://www.spc.noaa.gov/climo/reports";
const NWS_API_BASE = "https://api.weather.gov";

interface SPCReportRow {
	time: string;
	speed?: string;
	size?: string;
	location: string;
	county: string;
	state: string;
	lat: string;
	lon: string;
	comments?: string;
}

/**
 * Fetch today's storm reports from NOAA SPC
 */
export async function fetchTodaysStorms(): Promise<NOAAStormReport[]> {
	const reports: NOAAStormReport[] = [];
	
	try {
		// Fetch hail reports
		const hailReports = await fetchSPCReports("today_hail.csv");
		reports.push(...hailReports.map(r => ({ ...r, type: "hail" as const })));
		
		// Fetch wind reports
		const windReports = await fetchSPCReports("today_wind.csv");
		reports.push(...windReports.map(r => ({ ...r, type: "wind" as const })));
		
		// Fetch tornado reports
		const tornadoReports = await fetchSPCReports("today_torn.csv");
		reports.push(...tornadoReports.map(r => ({ ...r, type: "tornado" as const })));
		
	} catch (error) {
		console.error("Error fetching NOAA storm reports:", error);
	}
	
	return reports;
}

/**
 * Fetch storm reports for a specific date
 */
export async function fetchStormsForDate(date: Date): Promise<NOAAStormReport[]> {
	const reports: NOAAStormReport[] = [];
	const dateStr = formatSPCDate(date);
	
	try {
		const hailReports = await fetchSPCReports(`${dateStr}_rpts_hail.csv`);
		reports.push(...hailReports);
		
		const windReports = await fetchSPCReports(`${dateStr}_rpts_wind.csv`);
		reports.push(...windReports);
		
		const tornadoReports = await fetchSPCReports(`${dateStr}_rpts_torn.csv`);
		reports.push(...tornadoReports);
		
	} catch (error) {
		console.error(`Error fetching storms for ${dateStr}:`, error);
	}
	
	return reports;
}

/**
 * Fetch and parse SPC CSV report
 */
async function fetchSPCReports(filename: string): Promise<NOAAStormReport[]> {
	const url = `${NOAA_SPC_BASE}/${filename}`;
	
	try {
		const response = await fetch(url, {
			headers: { "Accept": "text/csv" },
			next: { revalidate: 300 } // Cache for 5 minutes
		});
		
		if (!response.ok) {
			return [];
		}
		
		const csvText = await response.text();
		return parseSPCCsv(csvText);
		
	} catch (error) {
		console.error(`Error fetching ${filename}:`, error);
		return [];
	}
}

/**
 * Parse SPC CSV format
 */
function parseSPCCsv(csvText: string): NOAAStormReport[] {
	const lines = csvText.trim().split("\n");
	if (lines.length < 2) return [];
	
	// Skip header row
	const dataLines = lines.slice(1);
	
	return dataLines.map(line => {
		const cols = line.split(",");
		return {
			time: cols[0] || "",
			speed: cols[1] ? parseInt(cols[1]) : undefined,
			size: cols[1] ? parseFloat(cols[1]) : undefined,
			location: cols[2] || "",
			county: cols[3] || "",
			state: cols[4] || "",
			lat: parseFloat(cols[5]) || 0,
			lon: parseFloat(cols[6]) || 0,
			comments: cols[7] || ""
		};
	}).filter(r => r.lat !== 0 && r.lon !== 0);
}

/**
 * Format date for SPC API (YYMMDD)
 */
function formatSPCDate(date: Date): string {
	const yy = date.getFullYear().toString().slice(-2);
	const mm = (date.getMonth() + 1).toString().padStart(2, "0");
	const dd = date.getDate().toString().padStart(2, "0");
	return `${yy}${mm}${dd}`;
}

/**
 * Fetch active weather alerts from NWS
 */
export async function fetchActiveAlerts(state?: string): Promise<WeatherAlert[]> {
	try {
		let url = `${NWS_API_BASE}/alerts/active`;
		if (state) {
			url += `?area=${state}`;
		}
		
		const response = await fetch(url, {
			headers: {
				"Accept": "application/geo+json",
				"User-Agent": "StormClose/1.0 (contact@stormclose.ai)"
			},
			next: { revalidate: 60 } // Cache for 1 minute
		});
		
		if (!response.ok) {
			throw new Error(`NWS API error: ${response.status}`);
		}
		
		const data = await response.json();
		
		return data.features?.map((feature: any) => ({
			id: feature.properties.id,
			event: feature.properties.event,
			headline: feature.properties.headline,
			description: feature.properties.description,
			severity: feature.properties.severity,
			urgency: feature.properties.urgency,
			areas: feature.properties.areaDesc?.split("; ") || [],
			onset: feature.properties.onset,
			expires: feature.properties.expires
		})) || [];
		
	} catch (error) {
		console.error("Error fetching NWS alerts:", error);
		return [];
	}
}

/**
 * Fetch weather alerts for a specific point
 */
export async function fetchAlertsForLocation(lat: number, lng: number): Promise<WeatherAlert[]> {
	try {
		const response = await fetch(
			`${NWS_API_BASE}/alerts/active?point=${lat},${lng}`,
			{
				headers: {
					"Accept": "application/geo+json",
					"User-Agent": "StormClose/1.0"
				},
				next: { revalidate: 60 }
			}
		);
		
		if (!response.ok) return [];
		
		const data = await response.json();
		return data.features?.map((f: any) => ({
			id: f.properties.id,
			event: f.properties.event,
			headline: f.properties.headline,
			description: f.properties.description,
			severity: f.properties.severity,
			urgency: f.properties.urgency,
			areas: f.properties.areaDesc?.split("; ") || [],
			onset: f.properties.onset,
			expires: f.properties.expires
		})) || [];
		
	} catch (error) {
		console.error("Error fetching location alerts:", error);
		return [];
	}
}

/**
 * Convert NOAA report to StormEvent format
 */
export function noaaReportToStormEvent(
	report: NOAAStormReport, 
	eventType: StormEventType
): Omit<StormEvent, "id" | "createdAt"> {
	return {
		externalId: `noaa-${eventType}-${report.lat}-${report.lon}-${report.time}`,
		eventType,
		severity: calculateSeverity(eventType, report),
		hailSizeInches: eventType === "hail" ? report.size : undefined,
		windSpeedMph: eventType === "wind" ? report.speed : undefined,
		city: report.location,
		state: report.state,
		county: report.county,
		latitude: report.lat,
		longitude: report.lon,
		radiusMiles: 5,
		eventDate: new Date().toISOString().split("T")[0],
		eventTime: report.time,
		source: "noaa",
		rawData: report as unknown as Record<string, unknown>
	};
}

/**
 * Calculate storm severity based on event type and metrics
 */
function calculateSeverity(type: StormEventType, report: NOAAStormReport): StormSeverity {
	if (type === "hail" && report.size) {
		if (report.size >= 2.0) return "extreme";      // Baseball+
		if (report.size >= 1.5) return "severe";       // Golf ball+
		if (report.size >= 1.0) return "moderate";     // Quarter+
		return "minor";
	}
	
	if (type === "wind" && report.speed) {
		if (report.speed >= 90) return "extreme";
		if (report.speed >= 70) return "severe";
		if (report.speed >= 58) return "moderate";
		return "minor";
	}
	
	if (type === "tornado") {
		// F-scale would be in comments, default to severe
		return "severe";
	}
	
	return "moderate";
}

/**
 * Get storms within radius of a point
 */
export function filterStormsInRadius(
	storms: StormEvent[],
	centerLat: number,
	centerLng: number,
	radiusMiles: number
): StormEvent[] {
	return storms.filter(storm => {
		const distance = calculateDistance(
			centerLat, centerLng,
			storm.latitude, storm.longitude
		);
		return distance <= radiusMiles;
	});
}

/**
 * Calculate distance between two points in miles (Haversine formula)
 */
export function calculateDistance(
	lat1: number, lon1: number,
	lat2: number, lon2: number
): number {
	const R = 3959; // Earth's radius in miles
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a = 
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function toRad(deg: number): number {
	return deg * (Math.PI / 180);
}
