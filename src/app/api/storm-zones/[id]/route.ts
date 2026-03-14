import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMockStormZoneDetail } from "@/lib/storms/mockStormsData";

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
	const zoneId = context.params.id;

	if (process.env.NODE_ENV === "test") {
		const detail = getMockStormZoneDetail(zoneId);
		if (!detail) {
			return NextResponse.json(
				{
					data: null,
					error: "Storm zone not found",
					meta: { id: zoneId },
				},
				{ status: 404 }
			);
		}

		return NextResponse.json({
			data: detail,
			error: null,
			meta: {
				id: zoneId,
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
	let detail = getMockStormZoneDetail(zoneId);
	let source = "mock";

	if (!useMock) {
		try {
			const { data: zone, error: zoneError } = await (supabase.from("storm_zones") as any)
				.select("*")
				.eq("id", zoneId)
				.maybeSingle();

			if (!zoneError && zone) {
				const { data: houseRows } = await (supabase.from("targets") as any)
					.select("id,address,city,state,zip,latitude,longitude")
					.eq("storm_zone_id", zoneId)
					.limit(25);

				detail = {
					zone: {
						id: zone.id,
						stormEventId: zone.storm_event_id,
						name: zone.name,
						centroidLat: 0,
						centroidLng: 0,
						radiusKm: Number(zone.radius_km) || 0,
						opportunityScore: Number(zone.opportunity_score) || 0,
						houseCount: Number(zone.house_count) || 0,
						unworkedCount: Number(zone.unworked_count) || 0,
						createdAt: zone.created_at,
						updatedAt: zone.updated_at,
					},
					houses: Array.isArray(houseRows)
						? houseRows.map((house: any) => ({
							id: house.id,
							address: house.address,
							neighborhood: house.city || "Unknown",
							city: house.city || "Unknown",
							state: house.state || "TX",
							zip: house.zip || "00000",
							stormZoneId: zoneId,
							stormZoneName: zone.name,
							opportunityScore: Number(zone.opportunity_score) || 0,
							scoreTier: "warm",
							stormAgeDays: 2,
							stormSeverity: "severe",
							estimatedValueBand: "$10k–$20k",
							assignedRepId: null,
							assignedRepName: null,
							missionId: null,
							status: "new",
							distanceMiles: null,
							aiRankingReason: "High impact in active storm corridor.",
							lat: Number(house.latitude) || 0,
							lng: Number(house.longitude) || 0,
							yearBuilt: null,
							roofAge: null,
							assessedValue: null,
						}))
						: [],
					severity:
						(Number(zone.opportunity_score) || 0) >= 80
							? "extreme"
							: (Number(zone.opportunity_score) || 0) >= 60
								? "severe"
								: (Number(zone.opportunity_score) || 0) >= 40
									? "moderate"
									: "minor",
					generatedAt: new Date().toISOString(),
				};
				source = "db";
			}
		} catch {
			detail = getMockStormZoneDetail(zoneId);
		}
	}

	if (!detail) {
		return NextResponse.json(
			{
				data: null,
				error: "Storm zone not found",
				meta: { id: zoneId },
			},
			{ status: 404 }
		);
	}

	return NextResponse.json({
		data: detail,
		error: null,
		meta: {
			id: zoneId,
			source,
			generatedAt: new Date().toISOString(),
		},
	});
}
