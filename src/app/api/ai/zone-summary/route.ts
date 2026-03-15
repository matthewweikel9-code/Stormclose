import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { extractModuleParams, resolveAiRequestContext } from "@/lib/ai/requestContract";
import {
	buildZoneSummaryPrompt,
	type ZoneSummaryParams,
	parseZoneSummaryOutput,
} from "@/lib/ai/modules/zoneSummary";

/**
 * POST /api/ai/zone-summary
 * Generates a storm zone intelligence report.
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
		const stormZoneId = typeof parsed.stormZoneId === "string" ? parsed.stormZoneId : "";

		if (!stormZoneId) {
			return NextResponse.json(
				{ data: null, error: "stormZoneId is required", meta: {} },
				{ status: 400 },
			);
		}

		const ctx = await resolveAiRequestContext(userId, body, {
			stormContext:
				typeof parsed.stormContext === "object" && parsed.stormContext !== null
					? (parsed.stormContext as never)
					: undefined,
			tonePreference:
				typeof parsed.tone === "object" && parsed.tone !== null
					? (parsed.tone as never)
					: undefined,
			outputFormat:
				typeof parsed.outputFormat === "string"
					? (parsed.outputFormat as never)
					: "markdown",
			userNotes: typeof parsed.userNotes === "string" ? parsed.userNotes : undefined,
		});

		const params: ZoneSummaryParams = {
			stormZoneId,
			includeCompetitiveLandscape: Boolean(parsed.includeCompetitiveLandscape ?? true),
			includeRevenueProjection: Boolean(parsed.includeRevenueProjection ?? true),
			includeDeploymentRecommendation: Boolean(parsed.includeDeploymentRecommendation ?? true),
			audience:
				typeof parsed.audience === "string"
					? (parsed.audience as ZoneSummaryParams["audience"])
					: "manager",
		};

		const { system, user } = buildZoneSummaryPrompt(ctx, params);
		const result = await generateFromPrompt(system, user);
		const output = parseZoneSummaryOutput(
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
