import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CORELOGIC_API_KEY = process.env.CORELOGIC_API_KEY;
const CORELOGIC_API_SECRET = process.env.CORELOGIC_API_SECRET;
const CORELOGIC_BASE_URL = "https://api-prod.corelogic.com";

export async function GET() {
	try {
		// Verify the user is authenticated
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check environment variables
		const envStatus = {
			CORELOGIC_API_KEY_present: !!CORELOGIC_API_KEY,
			CORELOGIC_API_KEY_length: CORELOGIC_API_KEY?.length || 0,
			CORELOGIC_API_SECRET_present: !!CORELOGIC_API_SECRET,
			CORELOGIC_API_SECRET_length: CORELOGIC_API_SECRET?.length || 0,
		};

		// Test OAuth authentication
		let authStatus = { success: false, error: "", expiresIn: 0 };
		
		if (CORELOGIC_API_KEY && CORELOGIC_API_SECRET) {
			const credentials = Buffer.from(`${CORELOGIC_API_KEY}:${CORELOGIC_API_SECRET}`).toString("base64");
			
			const response = await fetch(`${CORELOGIC_BASE_URL}/oauth/token?grant_type=client_credentials`, {
				method: "POST",
				headers: {
					"Authorization": `Basic ${credentials}`,
					"Content-Length": "0"
				}
			});

			if (response.ok) {
				const data = await response.json();
				authStatus = { 
					success: true, 
					error: "", 
					expiresIn: parseInt(data.expires_in)
				};
			} else {
				authStatus = { 
					success: false, 
					error: `OAuth failed: ${response.status} - ${await response.text()}`,
					expiresIn: 0
				};
			}
		} else {
			authStatus.error = "Missing credentials";
		}

		// Test a simple spatial search if auth succeeded
		let spatialTestResult = { success: false, parcelCount: 0, error: "" };
		
		if (authStatus.success) {
			const credentials = Buffer.from(`${CORELOGIC_API_KEY}:${CORELOGIC_API_SECRET}`).toString("base64");
			const tokenResponse = await fetch(`${CORELOGIC_BASE_URL}/oauth/token?grant_type=client_credentials`, {
				method: "POST",
				headers: { "Authorization": `Basic ${credentials}`, "Content-Length": "0" }
			});
			const tokenData = await tokenResponse.json();
			
			// Test with Edmond, OK coordinates (35.6528, -97.4781)
			const spatialUrl = new URL(`${CORELOGIC_BASE_URL}/spatial-tile/parcels`);
			spatialUrl.searchParams.append("lat", "35.6528");
			spatialUrl.searchParams.append("lon", "-97.4781");
			spatialUrl.searchParams.append("within", "1600");
			spatialUrl.searchParams.append("pageSize", "10");

			const spatialResponse = await fetch(spatialUrl.toString(), {
				headers: {
					"Authorization": `Bearer ${tokenData.access_token}`,
					"Content-Type": "application/json",
					"Accept": "application/json"
				}
			});

			if (spatialResponse.ok) {
				const data = await spatialResponse.json();
				spatialTestResult = {
					success: true,
					parcelCount: data.parcels?.length || 0,
					error: ""
				};
			} else {
				spatialTestResult = {
					success: false,
					parcelCount: 0,
					error: `Spatial API failed: ${spatialResponse.status} - ${await spatialResponse.text()}`
				};
			}
		}

		return NextResponse.json({
			timestamp: new Date().toISOString(),
			envStatus,
			authStatus,
			spatialTestResult
		});

	} catch (error) {
		return NextResponse.json({
			error: error instanceof Error ? error.message : "Unknown error"
		}, { status: 500 });
	}
}
