import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
	const requiredEnvVars = [
		"NEXT_PUBLIC_SUPABASE_URL",
		"NEXT_PUBLIC_SUPABASE_ANON_KEY",
		"SUPABASE_SERVICE_ROLE_KEY",
		"STRIPE_SECRET_KEY",
		"STRIPE_WEBHOOK_SECRET",
		"STRIPE_PRICE_ID_MONTHLY",
		"OPENAI_API_KEY"
	];

	const missingEnvVars = requiredEnvVars.filter(
		(key) => !process.env[key]?.trim()
	);

	const status = missingEnvVars.length === 0 ? "healthy" : "degraded";

	return NextResponse.json({
		status,
		timestamp: new Date().toISOString(),
		environment: process.env.NODE_ENV,
		missingEnvVars: missingEnvVars.length > 0 ? missingEnvVars : undefined
	});
}
