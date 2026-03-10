import { NextRequest, NextResponse } from "next/server";

const ATTOM_API_KEY = process.env.ATTOM_API_KEY;
const ATTOM_BASE_URL = "https://api.gateway.attomdata.com";

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const lat = searchParams.get("lat") || "35.4676";
		const lng = searchParams.get("lng") || "-97.5164";
		const radius = searchParams.get("radius") || "1";

		const debugInfo: any = {
			ATTOM_API_KEY_present: !!ATTOM_API_KEY,
			ATTOM_API_KEY_length: ATTOM_API_KEY?.length || 0,
			ATTOM_API_KEY_preview: ATTOM_API_KEY ? `${ATTOM_API_KEY.substring(0, 4)}...${ATTOM_API_KEY.slice(-4)}` : null,
			testParams: { lat, lng, radius }
		};

		// Test ATTOM API with property/detail for full property data
		if (ATTOM_API_KEY) {
			const url = new URL(`${ATTOM_BASE_URL}/propertyapi/v1.0.0/property/detail`);
			url.searchParams.append("latitude", lat);
			url.searchParams.append("longitude", lng);
			url.searchParams.append("radius", radius);
			url.searchParams.append("pagesize", "5");
			url.searchParams.append("propertytype", "SFR"); // Single Family Residence

			console.log("Testing ATTOM API with URL:", url.toString());

			const response = await fetch(url.toString(), {
				headers: {
					"Accept": "application/json",
					"APIKey": ATTOM_API_KEY
				}
			});

			debugInfo.apiResponse = {
				status: response.status,
				statusText: response.statusText,
				headers: Object.fromEntries(response.headers.entries())
			};

			if (response.ok) {
				const data = await response.json();
				debugInfo.apiResponse.success = true;
				debugInfo.apiResponse.propertyCount = data.property?.length || 0;
				
				const prop = data.property?.[0];
				if (prop) {
					debugInfo.apiResponse.sampleProperty = {
						address: prop.address,
						summary: prop.summary,
						building: {
							size: prop.building?.size,
							rooms: prop.building?.rooms,
							construction: prop.building?.construction
						},
						assessment: prop.assessment ? {
							assessed: prop.assessment.assessed,
							market: prop.assessment.market,
							owner: prop.assessment.owner?.owner1?.fullName
						} : null,
						lot: prop.lot,
						// Calculate what the estimate would be
						calculatedEstimate: {
							sqft: prop.building?.size?.livingSize || prop.building?.size?.universalSize || 2000,
							stories: prop.building?.summary?.stories || 1,
							assessedValue: prop.assessment?.assessed?.assdTtlValue || prop.assessment?.market?.mktTtlValue
						}
					};
				}
			} else {
				const errorText = await response.text();
				debugInfo.apiResponse.success = false;
				debugInfo.apiResponse.error = errorText;
			}
		}

		return NextResponse.json(debugInfo);
	} catch (error: any) {
		return NextResponse.json({
			error: error.message,
			stack: error.stack
		}, { status: 500 });
	}
}
