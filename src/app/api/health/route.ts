import { NextResponse } from "next/server";

export const runtime = "nodejs";

const REQUIRED_ENV_VARS = [
	"NEXT_PUBLIC_APP_URL",
	"NEXT_PUBLIC_SUPABASE_URL",
	"NEXT_PUBLIC_SUPABASE_ANON_KEY",
	"SUPABASE_SERVICE_ROLE_KEY",
	"STRIPE_SECRET_KEY",
	"STRIPE_WEBHOOK_SECRET",
	"STRIPE_PRICE_ID_PRO",
	"STRIPE_PRICE_ID_ENTERPRISE",
	"OPENAI_API_KEY",
	"XWEATHER_CLIENT_ID",
	"XWEATHER_CLIENT_SECRET",
	"CORELOGIC_CONSUMER_KEY",
	"CORELOGIC_CONSUMER_SECRET",
	"GOOGLE_MAPS_API_KEY",
	"NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
	"GOOGLE_SOLAR_API_KEY",
	"NEXT_PUBLIC_MAPBOX_TOKEN",
	"CRON_SECRET"
] as const;

const OPTIONAL_ENV_VARS = ["JOBNIMBUS_WEBHOOK_SECRET", "OPENAI_MODEL", "STRIPE_APP_URL"] as const;

export async function GET(request: Request) {
	const missingRequiredEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());
	const missingOptionalEnvVars = OPTIONAL_ENV_VARS.filter((key) => !process.env[key]?.trim());

	const status = missingRequiredEnvVars.length === 0 ? "healthy" : "degraded";
	const healthSecret = process.env.CRON_SECRET;
	const isAuthorized =
		Boolean(healthSecret) && request.headers.get("authorization") === `Bearer ${healthSecret}`;

	return NextResponse.json({
		status,
		timestamp: new Date().toISOString(),
		environment: process.env.NODE_ENV,
		missingRequiredCount: missingRequiredEnvVars.length,
		missingOptionalCount: missingOptionalEnvVars.length,
		...(isAuthorized
			? {
					missingRequiredEnvVars,
					missingOptionalEnvVars
				}
			: {})
	});
}
