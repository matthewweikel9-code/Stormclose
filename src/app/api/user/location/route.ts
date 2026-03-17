import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geolocation } from "@vercel/functions";

export const dynamic = "force-dynamic";

// GET: User's location — user_settings > user_metadata > IP-based (Vercel geo)
// IP-based gives automatic location without browser permission when deployed on Vercel
export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		// 1. Authenticated: try user_settings and user_metadata
		if (user) {
			const { data: settings } = await (supabase as any)
				.from("user_settings")
				.select("default_latitude, default_longitude")
				.eq("user_id", user.id)
				.single();

			let lat = settings?.default_latitude ?? user.user_metadata?.default_lat;
			let lng = settings?.default_longitude ?? user.user_metadata?.default_lng;
			if (lat != null && lng != null) {
				return NextResponse.json({ latitude: lat, longitude: lng });
			}
		}

		// 2. IP-based location (Vercel geo) — works without auth, no permission needed
		const geo = geolocation(request);
		const ipLat = geo.latitude != null ? parseFloat(String(geo.latitude)) : null;
		const ipLng = geo.longitude != null ? parseFloat(String(geo.longitude)) : null;
		if (ipLat != null && ipLng != null && !isNaN(ipLat) && !isNaN(ipLng)) {
			return NextResponse.json({ latitude: ipLat, longitude: ipLng });
		}

		return NextResponse.json({ latitude: null, longitude: null });
	} catch (error) {
		console.error("User location error:", error);
		return NextResponse.json({ error: "Failed to get location" }, { status: 500 });
	}
}
