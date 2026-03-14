import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { buildContext } from "@/lib/ai/buildContext";
import {
	buildRepCoachingPrompt,
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
		const { repId } = body;

		if (!repId) {
			return NextResponse.json(
				{ data: null, error: "repId is required", meta: {} },
				{ status: 400 },
			);
		}

		const ctx = await buildContext({
			userId,
			repContext: body.repContext ?? undefined,
			tonePreference: body.tone ?? undefined,
			outputFormat: "markdown",
			userNotes: body.userNotes ?? undefined,
		});

		const params = {
			repId,
			timeframe: body.timeframe ?? "7d",
			focusArea: body.focusArea ?? null,
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
