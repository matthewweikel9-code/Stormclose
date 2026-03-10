import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase with service role for bulk operations
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

// Parse NOAA historical CSV format
function parseNoaaHistoricalCsv(csvText: string): HailEvent[] {
	const lines = csvText.trim().split("\n");
	if (lines.length < 2) return [];

	const events: HailEvent[] = [];

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
			source: "noaa_historical",
		});
	}

	return events;
}

// POST: Import historical hail data
// This endpoint is designed to be called once to import the historical dataset
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { csvUrl, startYear, endYear, batchSize = 1000 } = body;

		// If CSV URL provided, fetch and import
		if (csvUrl) {
			console.log(`Fetching historical data from ${csvUrl}`);
			
			const response = await fetch(csvUrl);
			if (!response.ok) {
				return NextResponse.json(
					{ error: `Failed to fetch CSV: ${response.status}` },
					{ status: 400 }
				);
			}

			const csvText = await response.text();
			const allEvents = parseNoaaHistoricalCsv(csvText);

			console.log(`Parsed ${allEvents.length} historical hail events`);

			// Filter by year range if specified
			let events = allEvents;
			if (startYear || endYear) {
				events = allEvents.filter((e) => {
					const year = parseInt(e.event_date.split("-")[0], 10);
					if (startYear && year < startYear) return false;
					if (endYear && year > endYear) return false;
					return true;
				});
				console.log(`Filtered to ${events.length} events for years ${startYear || "all"}-${endYear || "all"}`);
			}

			// Insert in batches
			let totalInserted = 0;
			let errors = 0;

			for (let i = 0; i < events.length; i += batchSize) {
				const batch = events.slice(i, i + batchSize);
				
				const { error } = await supabaseAdmin
					.from("hail_events")
					.upsert(batch, {
						onConflict: "event_date,event_time,latitude,longitude,size_inches",
						ignoreDuplicates: true,
					});

				if (error) {
					console.error(`Batch ${i / batchSize + 1} error:`, error);
					errors++;
				} else {
					totalInserted += batch.length;
				}

				// Log progress every 10 batches
				if ((i / batchSize) % 10 === 0) {
					console.log(`Progress: ${i + batch.length}/${events.length} events processed`);
				}
			}

			return NextResponse.json({
				success: true,
				totalParsed: allEvents.length,
				totalFiltered: events.length,
				totalInserted,
				errors,
			});
		}

		// Otherwise, fetch from NOAA directly
		const url = "https://www.spc.noaa.gov/wcm/data/1955-2023_hail.csv.zip";
		
		return NextResponse.json({
			message: "To import historical data, provide the csvUrl parameter with a direct link to the CSV file, or manually import from NOAA",
			noaaUrl: url,
			instructions: [
				"1. Download the ZIP from NOAA",
				"2. Extract the CSV file",
				"3. Host it somewhere accessible or use a data URL",
				"4. Call this endpoint with csvUrl parameter",
			],
		});
	} catch (error) {
		console.error("Historical import error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// GET: Check import status
export async function GET() {
	try {
		// Get count of hail events
		const { count, error } = await supabaseAdmin
			.from("hail_events")
			.select("*", { count: "exact", head: true });

		if (error) {
			return NextResponse.json(
				{ error: "Failed to query database" },
				{ status: 500 }
			);
		}

		// Get date range
		const { data: dateRange } = await supabaseAdmin
			.from("hail_events")
			.select("event_date")
			.order("event_date", { ascending: true })
			.limit(1);

		const { data: latestDate } = await supabaseAdmin
			.from("hail_events")
			.select("event_date")
			.order("event_date", { ascending: false })
			.limit(1);

		// Get count by year (last 10 years)
		const { data: recentCounts } = await supabaseAdmin.rpc("get_hail_counts_by_year");

		return NextResponse.json({
			success: true,
			totalEvents: count || 0,
			dateRange: {
				earliest: dateRange?.[0]?.event_date || null,
				latest: latestDate?.[0]?.event_date || null,
			},
			recentYears: recentCounts || [],
		});
	} catch (error) {
		console.error("Status check error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
