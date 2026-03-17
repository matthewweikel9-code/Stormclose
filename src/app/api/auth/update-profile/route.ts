import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const GOOGLE_MAPS_API_KEY =
	process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.GOOGLE_SOLAR_API_KEY?.trim();

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
	if (!GOOGLE_MAPS_API_KEY || !address?.trim()) return null;
	try {
		const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address.trim())}&key=${GOOGLE_MAPS_API_KEY}`;
		const res = await fetch(url);
		const data = await res.json();
		if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
			const { lat, lng } = data.results[0].geometry.location;
			return { lat, lng };
		}
		return null;
	} catch {
		return null;
	}
}

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user }, error: authError } = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();

		// If default_location is provided but lat/lng are missing, geocode it
		let defaultLat = body.default_lat ?? user.user_metadata?.default_lat;
		let defaultLng = body.default_lng ?? user.user_metadata?.default_lng;
		if (
			(body.default_location || user.user_metadata?.default_location) &&
			(defaultLat == null || defaultLng == null)
		) {
			const address = body.default_location || user.user_metadata?.default_location;
			const coords = await geocodeAddress(address);
			if (coords) {
				defaultLat = coords.lat;
				defaultLng = coords.lng;
				body.default_lat = coords.lat;
				body.default_lng = coords.lng;
			}
		}

		// Update user metadata in Supabase Auth
		const { error: updateError } = await supabase.auth.updateUser({
			data: {
				...user.user_metadata,
				...body,
			},
		});

		if (updateError) {
			console.error("Error updating profile:", updateError);
			return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
		}

		// Sync default location to user_settings for APIs that read from there
		const lat = body.default_lat ?? defaultLat;
		const lng = body.default_lng ?? defaultLng;
		if (lat != null && lng != null) {
			await (supabase as any).from("user_settings").upsert(
				{
					user_id: user.id,
					default_latitude: lat,
					default_longitude: lng,
					default_city: body.default_city ?? null,
					default_state: body.default_state ?? null,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "user_id" }
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error updating profile:", error);
		return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
	}
}
