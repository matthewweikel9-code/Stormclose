import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { buildContext } from "@/lib/ai/buildContext";
import {
	buildZoneSummaryPrompt,
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
		const { stormZoneId } = body;

		if (!stormZoneId) {
			return NextResponse.json(
				{ data: null, error: "stormZoneId is required", meta: {} },
				{ status: 400 },
			);
		}

		const ctx = await buildContext({
			userId,
			stormContext: body.stormContext ?? undefined,
			tonePreference: body.tone ?? undefined,
			outputFormat: body.outputFormat ?? "markdown",
			userNotes: body.userNotes ?? undefined,
		});

		const params = {
			stormZoneId,
			includeCompetitiveLandscape: body.includeCompetitiveLandscape ?? true,
			includeRevenueProjection: body.includeRevenueProjection ?? true,
			includeDeploymentRecommendation:
				body.includeDeploymentRecommendation ?? true,
			audience: body.audience ?? "manager",
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
