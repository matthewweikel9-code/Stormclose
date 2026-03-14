import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMockStormZones } from "@/lib/storms/mockStormsData";
import type { StormZone } from "@/types/storms";

function parseNumberParam(value: string | null): number | null {
	if (!value) {
		return null;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function applyFilters(zones: StormZone[], request: NextRequest): StormZone[] {
	const { searchParams } = new URL(request.url);
	const minScore = parseNumberParam(searchParams.get("minScore"));
	const maxScore = parseNumberParam(searchParams.get("maxScore"));
	const minUnworked = parseNumberParam(searchParams.get("minUnworked"));
	const q = searchParams.get("q")?.trim().toLowerCase();

	return zones.filter((zone) => {
		if (minScore !== null && zone.opportunityScore < minScore) {
			return false;
		}
		if (maxScore !== null && zone.opportunityScore > maxScore) {
			return false;
		}
		if (minUnworked !== null && zone.unworkedCount < minUnworked) {
			return false;
		}
		if (q && !zone.name.toLowerCase().includes(q)) {
			return false;
		}
		return true;
	});
}

function getLimit(request: NextRequest): number {
	const { searchParams } = new URL(request.url);
	const limit = parseNumberParam(searchParams.get("limit"));
	if (limit === null || limit <= 0) {
		return 50;
	}
	return Math.min(limit, 200);
}

export async function GET(request: NextRequest) {
	if (process.env.NODE_ENV === "test") {
		const zones = applyFilters(getMockStormZones(), request);
		const limit = getLimit(request);
		return NextResponse.json({
			data: zones.slice(0, limit),
			error: null,
			meta: {
				total: zones.length,
				limit,
				source: "mock",
				generatedAt: new Date().toISOString(),
			},
		});
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const useMock = !user;
	let source: "mock" | "db" = "mock";

	let zones: StormZone[] = [];

	if (!useMock) {
		try {
			const { data, error } = await (supabase.from("storm_zones") as any)
				.select("*")
				.order("opportunity_score", { ascending: false })
				.limit(250);

			if (!error && Array.isArray(data) && data.length > 0) {
				source = "db";
				zones = data.map((row) => {
					const centroid = typeof row.centroid === "string" ? row.centroid : "";
					const latLngMatch = centroid.match(/\(([-0-9.]+)\s+([-0-9.]+)\)/);
					const lng = latLngMatch ? Number(latLngMatch[1]) : 0;
					const lat = latLngMatch ? Number(latLngMatch[2]) : 0;
					return {
						id: row.id,
						stormEventId: row.storm_event_id,
						name: row.name,
						centroidLat: lat,
						centroidLng: lng,
						radiusKm: Number(row.radius_km) || 0,
						opportunityScore: Number(row.opportunity_score) || 0,
						houseCount: Number(row.house_count) || 0,
						unworkedCount: Number(row.unworked_count) || 0,
						createdAt: row.created_at,
						updatedAt: row.updated_at,
					};
				});
			}
		} catch {
			zones = [];
		}
	}

	if (zones.length === 0) {
		zones = getMockStormZones();
		source = "mock";
	}

	const filtered = applyFilters(zones, request);
	const limit = getLimit(request);

	const payload = {
		data: filtered.slice(0, limit),
		error: null,
		meta: {
			total: filtered.length,
			limit,
			source,
			generatedAt: new Date().toISOString(),
		},
	};

	return NextResponse.json(payload);
}
