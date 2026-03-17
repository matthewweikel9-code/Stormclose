import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET: User's default location from user_settings (fallback when geolocation fails)
export async function GET() {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { data: settings } = await (supabase as any)
			.from("user_settings")
			.select("default_latitude, default_longitude")
			.eq("user_id", user.id)
			.single();

		let lat = settings?.default_latitude;
		let lng = settings?.default_longitude;
		if (lat == null || lng == null) {
			lat = user.user_metadata?.default_lat;
			lng = user.user_metadata?.default_lng;
		}
		if (lat == null || lng == null) {
			return NextResponse.json({ latitude: null, longitude: null });
		}

		return NextResponse.json({ latitude: lat, longitude: lng });
	} catch (error) {
		console.error("User location error:", error);
		return NextResponse.json({ error: "Failed to get location" }, { status: 500 });
	}
}
