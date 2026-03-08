import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ACCUWEATHER_API_KEY = process.env.ACCUWEATHER_API_KEY;
const ACCUWEATHER_BASE_URL = "https://dataservice.accuweather.com";

// Get location key from coordinates or search
async function getLocationKey(query: string): Promise<{ key: string; name: string; state: string } | null> {
	// Try city search first
	const searchUrl = `${ACCUWEATHER_BASE_URL}/locations/v1/cities/search?apikey=${ACCUWEATHER_API_KEY}&q=${encodeURIComponent(query)}`;
	
	const response = await fetch(searchUrl);
	if (!response.ok) {
		console.error("AccuWeather location search failed:", await response.text());
		return null;
	}
	
	const data = await response.json();
	if (data.length === 0) return null;
	
	return {
		key: data[0].Key,
		name: data[0].LocalizedName,
		state: data[0].AdministrativeArea?.ID || ""
	};
}

// Get location key from lat/lng
async function getLocationKeyFromCoords(lat: number, lng: number): Promise<{ key: string; name: string; state: string } | null> {
	const geoUrl = `${ACCUWEATHER_BASE_URL}/locations/v1/cities/geoposition/search?apikey=${ACCUWEATHER_API_KEY}&q=${lat},${lng}`;
	
	const response = await fetch(geoUrl);
	if (!response.ok) {
		console.error("AccuWeather geoposition search failed:", await response.text());
		return null;
	}
	
	const data = await response.json();
	return {
		key: data.Key,
		name: data.LocalizedName,
		state: data.AdministrativeArea?.ID || ""
	};
}

// Get severe weather alerts for a location
async function getAlerts(locationKey: string): Promise<any[]> {
	const alertsUrl = `${ACCUWEATHER_BASE_URL}/alerts/v1/${locationKey}?apikey=${ACCUWEATHER_API_KEY}`;
	
	const response = await fetch(alertsUrl);
	if (!response.ok) {
		// Alerts endpoint may return 204 No Content if no alerts
		if (response.status === 204) return [];
		console.error("AccuWeather alerts failed:", await response.text());
		return [];
	}
	
	const data = await response.json();
	return data || [];
}

// Get current conditions
async function getCurrentConditions(locationKey: string): Promise<any> {
	const conditionsUrl = `${ACCUWEATHER_BASE_URL}/currentconditions/v1/${locationKey}?apikey=${ACCUWEATHER_API_KEY}&details=true`;
	
	const response = await fetch(conditionsUrl);
	if (!response.ok) {
		console.error("AccuWeather conditions failed:", await response.text());
		return null;
	}
	
	const data = await response.json();
	return data[0] || null;
}

// Get 1-day forecast with details
async function getForecast(locationKey: string): Promise<any> {
	const forecastUrl = `${ACCUWEATHER_BASE_URL}/forecasts/v1/daily/1day/${locationKey}?apikey=${ACCUWEATHER_API_KEY}&details=true`;
	
	const response = await fetch(forecastUrl);
	if (!response.ok) {
		console.error("AccuWeather forecast failed:", await response.text());
		return null;
	}
	
	return await response.json();
}

export async function GET(request: NextRequest) {
	try {
		// Check authentication
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const searchParams = request.nextUrl.searchParams;
		const query = searchParams.get("query"); // City name or ZIP
		const lat = searchParams.get("lat");
		const lng = searchParams.get("lng");

		if (!query && (!lat || !lng)) {
			return NextResponse.json(
				{ error: "Provide either 'query' (city/ZIP) or 'lat' and 'lng'" },
				{ status: 400 }
			);
		}

		// Get location key
		let location;
		if (lat && lng) {
			location = await getLocationKeyFromCoords(parseFloat(lat), parseFloat(lng));
		} else if (query) {
			location = await getLocationKey(query);
		}

		if (!location) {
			return NextResponse.json(
				{ error: "Location not found" },
				{ status: 404 }
			);
		}

		// Fetch weather data in parallel
		const [alerts, conditions, forecast] = await Promise.all([
			getAlerts(location.key),
			getCurrentConditions(location.key),
			getForecast(location.key)
		]);

		// Process alerts for severe weather
		const severeAlerts = alerts.map(alert => ({
			type: alert.Category,
			severity: alert.Severity,
			headline: alert.Headline?.Text,
			description: alert.Area?.[0]?.Text,
			startTime: alert.Headline?.EffectiveDate,
			endTime: alert.Headline?.EndDate,
			source: alert.Source
		}));

		// Check for hail/storm indicators
		const hasHailRisk = forecast?.DailyForecasts?.[0]?.Day?.HasPrecipitation && 
			(forecast?.DailyForecasts?.[0]?.Day?.PrecipitationType === "Ice" ||
			 forecast?.DailyForecasts?.[0]?.Day?.ThunderstormProbability > 40);

		return NextResponse.json({
			location: {
				name: location.name,
				state: location.state,
				key: location.key
			},
			current: conditions ? {
				temperature: conditions.Temperature?.Imperial?.Value,
				conditions: conditions.WeatherText,
				icon: conditions.WeatherIcon,
				humidity: conditions.RelativeHumidity,
				wind: {
					speed: conditions.Wind?.Speed?.Imperial?.Value,
					direction: conditions.Wind?.Direction?.English
				},
				uvIndex: conditions.UVIndex,
				visibility: conditions.Visibility?.Imperial?.Value,
				pressure: conditions.Pressure?.Imperial?.Value
			} : null,
			alerts: severeAlerts,
			alertCount: severeAlerts.length,
			forecast: forecast?.DailyForecasts?.[0] ? {
				high: forecast.DailyForecasts[0].Temperature?.Maximum?.Value,
				low: forecast.DailyForecasts[0].Temperature?.Minimum?.Value,
				precipitation: forecast.DailyForecasts[0].Day?.PrecipitationProbability,
				thunderstorm: forecast.DailyForecasts[0].Day?.ThunderstormProbability,
				description: forecast.DailyForecasts[0].Day?.LongPhrase
			} : null,
			stormRisk: {
				hasHailRisk,
				thunderstormProbability: forecast?.DailyForecasts?.[0]?.Day?.ThunderstormProbability || 0,
				severeWeatherActive: severeAlerts.length > 0
			}
		});

	} catch (error) {
		console.error("Storm alerts error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to get weather data" },
			{ status: 500 }
		);
	}
}

// POST endpoint to get alerts for multiple locations
export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { locations } = body; // Array of { name, lat, lng }

		if (!locations || !Array.isArray(locations)) {
			return NextResponse.json(
				{ error: "Provide 'locations' array" },
				{ status: 400 }
			);
		}

		// Process locations (limit to 5 to avoid rate limits)
		const results = await Promise.all(
			locations.slice(0, 5).map(async (loc: { name?: string; lat?: number; lng?: number }) => {
				let location;
				if (loc.lat && loc.lng) {
					location = await getLocationKeyFromCoords(loc.lat, loc.lng);
				} else if (loc.name) {
					location = await getLocationKey(loc.name);
				}

				if (!location) return null;

				const alerts = await getAlerts(location.key);
				return {
					location: {
						name: location.name,
						state: location.state,
						requested: loc.name || `${loc.lat},${loc.lng}`
					},
					alerts: alerts.map(a => ({
						type: a.Category,
						severity: a.Severity,
						headline: a.Headline?.Text
					})),
					alertCount: alerts.length,
					hasSevereWeather: alerts.length > 0
				};
			})
		);

		return NextResponse.json({
			locations: results.filter(Boolean),
			totalAlerts: results.reduce((sum, r) => sum + (r?.alertCount || 0), 0)
		});

	} catch (error) {
		console.error("Multi-location alerts error:", error);
		return NextResponse.json(
			{ error: "Failed to get alerts" },
			{ status: 500 }
		);
	}
}
