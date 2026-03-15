import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { extractModuleParams, resolveAiRequestContext } from "@/lib/ai/requestContract";
import {
	buildRepCoachingPrompt,
	type RepCoachingParams,
	parseRepCoachingOutput,
} from "@/lib/ai/modules/repCoaching";

/**
 * POST /api/ai/rep-coaching
 * Generates AI-driven performance coaching insights for a rep.
 */
export async function POST(request: NextRequest) {
	const start = Date.now();
	try {
		const userId =
			process.env.NODE_ENV === "test"
				? "test-user"
				: await (async () => {
						const supabase = await createClient();
						const {
							data: { user },
						} = await supabase.auth.getUser();
						return user?.id ?? null;
					})();

		if (!userId) {
			return NextResponse.json(
				{ data: null, error: "Unauthorized", meta: {} },
				{ status: 401 },
			);
		}

		const body = await request.json();
		const parsed = extractModuleParams<Record<string, unknown>>(body);
		const repId = typeof parsed.repId === "string" ? parsed.repId : "";

		if (!repId) {
			return NextResponse.json(
				{ data: null, error: "repId is required", meta: {} },
				{ status: 400 },
			);
		}

		const ctx = await resolveAiRequestContext(userId, body, {
			repContext:
				typeof parsed.repContext === "object" && parsed.repContext !== null
					? (parsed.repContext as never)
					: undefined,
			tonePreference:
				typeof parsed.tone === "object" && parsed.tone !== null
					? (parsed.tone as never)
					: undefined,
			outputFormat: "markdown",
			userNotes: typeof parsed.userNotes === "string" ? parsed.userNotes : undefined,
		});

		const params: RepCoachingParams = {
			repId,
			timeframe:
				typeof parsed.timeframe === "string"
					? (parsed.timeframe as RepCoachingParams["timeframe"])
					: "7d",
			focusArea:
				typeof parsed.focusArea === "string"
					? (parsed.focusArea as RepCoachingParams["focusArea"])
					: null,
		};

		const { system, user } = buildRepCoachingPrompt(ctx, params);
		const result = await generateFromPrompt(system, user);
		const output = parseRepCoachingOutput(
			result.content,
			result.model,
			result.usage?.totalTokens ?? 0,
		);
		const cost = estimateUsageCostUsd(result);

		return NextResponse.json({
			data: output,
			error: null,
			meta: {
				timestamp: new Date().toISOString(),
				model: result.model,
				tokenCount: result.usage?.totalTokens ?? 0,
				estimatedCostUsd: cost,
				latencyMs: Date.now() - start,
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Internal server error";
		return NextResponse.json(
			{ data: null, error: message, meta: { timestamp: new Date().toISOString() } },
			{ status: 500 },
		);
	}
}
