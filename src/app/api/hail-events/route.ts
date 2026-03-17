import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCronAuth } from "@/lib/server/cron-auth";

// Initialize Supabase with service role for hail data operations
const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface HailEvent {
	event_date: string;
	event_time: string | null;
	timezone: number;
	state: string;
	county: string | null;
	location_name: string | null;
	latitude: number;
	longitude: number;
	size_inches: number;
	comments: string | null;
	source: string;
}

// Parse NOAA CSV format
function parseNoaaHailCsv(csvText: string): HailEvent[] {
	const lines = csvText.trim().split("\n");
	if (lines.length < 2) return [];

	const events: HailEvent[] = [];

	// Skip header line
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line.trim()) continue;

		// CSV format: Time,Size,Location,County,State,Lat,Lon,Comments
		const parts = line.split(",");
		if (parts.length < 7) continue;

		const time = parts[0]?.trim();
		const sizeHundredths = parseInt(parts[1]?.trim() || "0", 10); // Size in hundredths of inches
		const location = parts[2]?.trim();
		const county = parts[3]?.trim();
		const state = parts[4]?.trim();
		const lat = parseFloat(parts[5]?.trim() || "0");
		const lon = parseFloat(parts[6]?.trim() || "0");
		const comments = parts.slice(7).join(",").trim();

		if (!state || !lat || !lon || sizeHundredths === 0) continue;

		// Convert time format (HHMM) to HH:MM:SS
		let eventTime: string | null = null;
		if (time && time.length >= 4) {
			const hours = time.slice(0, 2).padStart(2, "0");
			const minutes = time.slice(2, 4).padStart(2, "0");
			eventTime = `${hours}:${minutes}:00`;
		}

		events.push({
			event_date: "", // Will be set by caller
			event_time: eventTime,
			timezone: 3, // CST
			state,
			county: county || null,
			location_name: location || null,
			latitude: lat,
			longitude: lon,
			size_inches: sizeHundredths / 100, // Convert to inches
			comments: comments || null,
			source: "noaa",
		});
	}

	return events;
}

// Parse NOAA historical CSV format (different structure)
function parseNoaaHistoricalCsv(csvText: string): HailEvent[] {
	const lines = csvText.trim().split("\n");
	if (lines.length < 2) return [];

	const events: HailEvent[] = [];

	// Skip header line
	// Format: om,yr,mo,dy,date,time,tz,st,stf,stn,mag,inj,fat,loss,closs,slat,slon,elat,elon,len,wid,ns,sn,sg,f1,f2,f3,f4
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line.trim()) continue;

		const parts = line.split(",");
		if (parts.length < 17) continue;

		const date = parts[4]?.trim(); // YYYY-MM-DD
		const time = parts[5]?.trim(); // HH:MM:SS
		const state = parts[7]?.trim();
		const mag = parseFloat(parts[10]?.trim() || "0"); // Magnitude (hail size in inches)
		const lat = parseFloat(parts[15]?.trim() || "0");
		const lon = parseFloat(parts[16]?.trim() || "0");

		if (!date || !state || !lat || !lon || mag === 0) continue;

		events.push({
			event_date: date,
			event_time: time || null,
			timezone: 3,
			state,
			county: null,
			location_name: null,
			latitude: lat,
			longitude: lon,
			size_inches: mag,
			comments: null,
			source: "noaa",
		});
	}

	return events;
}

// Fetch daily hail reports from NOAA
async function fetchDailyHailReports(date: Date): Promise<HailEvent[]> {
	const year = date.getFullYear().toString().slice(-2);
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");

	const dateStr = `${year}${month}${day}`;
	const url = `https://www.spc.noaa.gov/climo/reports/${dateStr}_rpts_hail.csv`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			console.log(`No hail data for ${dateStr}`);
			return [];
		}

		const csvText = await response.text();
		const events = parseNoaaHailCsv(csvText);

		// Set the date for each event
		const formattedDate = `${date.getFullYear()}-${month}-${day}`;
		return events.map((e) => ({ ...e, event_date: formattedDate }));
	} catch (error) {
		console.error(`Error fetching hail data for ${dateStr}:`, error);
		return [];
	}
}

// Fetch today's hail reports (updates throughout the day)
async function fetchTodayHailReports(): Promise<HailEvent[]> {
	const url = "https://www.spc.noaa.gov/climo/reports/today_hail.csv";

	try {
		const response = await fetch(url);
		if (!response.ok) return [];

		const csvText = await response.text();
		const events = parseNoaaHailCsv(csvText);

		// Set today's date
		const today = new Date();
		const formattedDate = today.toISOString().split("T")[0];
		return events.map((e) => ({ ...e, event_date: formattedDate }));
	} catch (error) {
		console.error("Error fetching today's hail data:", error);
		return [];
	}
}

// Insert hail events into database (upsert to avoid duplicates)
async function insertHailEvents(events: HailEvent[]): Promise<number> {
	if (events.length === 0) return 0;

	let inserted = 0;

	// Insert in batches of 100
	for (let i = 0; i < events.length; i += 100) {
		const batch = events.slice(i, i + 100);

		const { error } = await supabaseAdmin
			.from("hail_events")
			.upsert(batch, {
				onConflict: "event_date,event_time,latitude,longitude,size_inches",
				ignoreDuplicates: true,
			});

		if (error) {
			console.error("Error inserting hail events:", error);
		} else {
			inserted += batch.length;
		}
	}

	return inserted;
}

// GET: Query hail events near a location
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const lat = parseFloat(searchParams.get("lat") || "0");
	const lng = parseFloat(searchParams.get("lng") || "0");
	const radiusMiles = parseFloat(searchParams.get("radius") || "10");
	const daysBack = parseInt(searchParams.get("days") || "30", 10);

	if (!lat || !lng) {
		return NextResponse.json(
			{ error: "lat and lng parameters are required" },
			{ status: 400 }
		);
	}

	try {
		// Use the find_nearby_hail_events function
		const { data, error } = await supabaseAdmin.rpc("find_nearby_hail_events", {
			p_latitude: lat,
			p_longitude: lng,
			p_radius_miles: radiusMiles,
			p_days_back: daysBack,
		});

		if (error) {
			console.error("Error querying hail events:", error);
			return NextResponse.json(
				{ error: "Failed to query hail events" },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			events: data || [],
			query: { lat, lng, radiusMiles, daysBack },
		});
	} catch (error) {
		console.error("Hail events error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// POST: Trigger hail data sync
export async function POST(request: NextRequest) {
	const cronAuth = requireCronAuth(request);
	if (!cronAuth.ok) {
		return cronAuth.response;
	}

	try {
		const body = await request.json();
		const { action, date, daysBack } = body;

		if (action === "sync_today") {
			// Fetch today's reports
			const events = await fetchTodayHailReports();
			const inserted = await insertHailEvents(events);

			return NextResponse.json({
				success: true,
				action: "sync_today",
				eventsFound: events.length,
				eventsInserted: inserted,
			});
		}

		if (action === "sync_date" && date) {
			// Fetch specific date
			const targetDate = new Date(date);
			const events = await fetchDailyHailReports(targetDate);
			const inserted = await insertHailEvents(events);

			return NextResponse.json({
				success: true,
				action: "sync_date",
				date,
				eventsFound: events.length,
				eventsInserted: inserted,
			});
		}

		if (action === "sync_recent") {
			// Fetch last N days
			const days = daysBack || 7;
			let totalEvents = 0;
			let totalInserted = 0;

			for (let i = 0; i < days; i++) {
				const date = new Date();
				date.setDate(date.getDate() - i);

				const events = await fetchDailyHailReports(date);
				const inserted = await insertHailEvents(events);

				totalEvents += events.length;
				totalInserted += inserted;
			}

			return NextResponse.json({
				success: true,
				action: "sync_recent",
				daysProcessed: days,
				eventsFound: totalEvents,
				eventsInserted: totalInserted,
			});
		}

		return NextResponse.json(
			{ error: "Invalid action. Use: sync_today, sync_date, or sync_recent" },
			{ status: 400 }
		);
	} catch (error) {
		console.error("Hail sync error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
