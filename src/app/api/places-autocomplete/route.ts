import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_API_KEY = process.env.GOOGLE_SOLAR_API_KEY;

export async function GET(request: NextRequest) {
	try {
		// Check authentication
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const searchParams = request.nextUrl.searchParams;
		const input = searchParams.get("input");

		if (!input || input.length < 3) {
			return NextResponse.json({ predictions: [] });
		}

		// Google Places Autocomplete API
		const response = await fetch(
			`https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
			`input=${encodeURIComponent(input)}` +
			`&types=address` +
			`&components=country:us` +
			`&key=${GOOGLE_API_KEY}`
		);

		if (!response.ok) {
			throw new Error("Places API failed");
		}

		const data = await response.json();

		if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
			throw new Error(data.error_message || "Places API error");
		}

		const predictions = (data.predictions || []).map((p: {
			place_id: string;
			description: string;
			structured_formatting: {
				main_text: string;
				secondary_text: string;
			};
		}) => ({
			placeId: p.place_id,
			description: p.description,
			mainText: p.structured_formatting?.main_text,
			secondaryText: p.structured_formatting?.secondary_text
		}));

		return NextResponse.json({ predictions });

	} catch (error) {
		console.error("Places autocomplete error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch suggestions" },
			{ status: 500 }
		);
	}
}
