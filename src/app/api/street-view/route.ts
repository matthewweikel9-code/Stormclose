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
		const address = searchParams.get("address");
		const lat = searchParams.get("lat");
		const lng = searchParams.get("lng");
		const size = searchParams.get("size") || "600x400";
		const heading = searchParams.get("heading") || "";
		const pitch = searchParams.get("pitch") || "0";
		const fov = searchParams.get("fov") || "90";

		let location: string;

		if (lat && lng) {
			location = `${lat},${lng}`;
		} else if (address) {
			location = encodeURIComponent(address);
		} else {
			return NextResponse.json(
				{ error: "Address or coordinates required" },
				{ status: 400 }
			);
		}

		// First check if Street View imagery exists
		const metadataUrl = 
			`https://maps.googleapis.com/maps/api/streetview/metadata?` +
			`location=${location}` +
			`&key=${GOOGLE_API_KEY}`;

		const metaResponse = await fetch(metadataUrl);
		const metadata = await metaResponse.json();

		if (metadata.status !== "OK") {
			return NextResponse.json({
				available: false,
				error: "Street View imagery not available for this location"
			});
		}

		// Build Street View image URL
		let imageUrl = 
			`https://maps.googleapis.com/maps/api/streetview?` +
			`size=${size}` +
			`&location=${location}` +
			`&key=${GOOGLE_API_KEY}` +
			`&pitch=${pitch}` +
			`&fov=${fov}`;

		if (heading) {
			imageUrl += `&heading=${heading}`;
		}

		return NextResponse.json({
			available: true,
			imageUrl,
			metadata: {
				date: metadata.date,
				panoId: metadata.pano_id,
				location: metadata.location
			}
		});

	} catch (error) {
		console.error("Street View error:", error);
		return NextResponse.json(
			{ error: "Failed to get Street View" },
			{ status: 500 }
		);
	}
}
