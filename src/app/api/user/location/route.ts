import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	try {
		// 1. Vercel IP geolocation (instant, no auth needed, production only)
		const ipLatStr = request.headers.get("x-vercel-ip-latitude");
		const ipLngStr = request.headers.get("x-vercel-ip-longitude");
		const ipLat = ipLatStr ? parseFloat(ipLatStr) : NaN;
		const ipLng = ipLngStr ? parseFloat(ipLngStr) : NaN;
		const hasIpGeo = !isNaN(ipLat) && !isNaN(ipLng);

		// 2. Check user_settings and user_metadata (requires auth)
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (user) {
			const { data: settings } = await (supabase as any)
				.from("user_settings")
				.select("default_latitude, default_longitude")
				.eq("user_id", user.id)
				.maybeSingle();

			const savedLat = settings?.default_latitude ?? user.user_metadata?.default_lat;
			const savedLng = settings?.default_longitude ?? user.user_metadata?.default_lng;
			if (savedLat != null && savedLng != null) {
				return NextResponse.json({ latitude: savedLat, longitude: savedLng });
			}
		}

		// 3. Fall back to IP geolocation
		if (hasIpGeo) {
			return NextResponse.json({ latitude: ipLat, longitude: ipLng });
		}

		return NextResponse.json({ latitude: null, longitude: null });
	} catch (error) {
		console.error("User location error:", error);
		return NextResponse.json({ latitude: null, longitude: null });
	}
}
