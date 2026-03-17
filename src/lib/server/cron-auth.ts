import { NextResponse } from "next/server";

type CronAuthResult =
	| { ok: true }
	| { ok: false; response: NextResponse };

export function requireCronAuth(request: Request): CronAuthResult {
	const cronSecret = process.env.CRON_SECRET?.trim();
	const isProduction = process.env.NODE_ENV === "production";

	if (!cronSecret) {
		if (isProduction) {
			return {
				ok: false,
				response: NextResponse.json(
					{ error: "CRON_SECRET is required in production" },
					{ status: 500 }
				)
			};
		}
		// Allow local development without a secret.
		return { ok: true };
	}

	const authHeader = request.headers.get("authorization");
	if (authHeader !== `Bearer ${cronSecret}`) {
		return {
			ok: false,
			response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		};
	}

	return { ok: true };
}
