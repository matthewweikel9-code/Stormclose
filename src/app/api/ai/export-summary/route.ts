import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { buildContext } from "@/lib/ai/buildContext";
import {
	buildExportSummaryPrompt,
	parseExportSummaryOutput,
} from "@/lib/ai/modules/exportSummary";

/**
 * POST /api/ai/export-summary
 * Generates structured CRM handoff summaries for qualified opportunities.
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
		const { houseId } = body;

		if (!houseId) {
			return NextResponse.json(
				{ data: null, error: "houseId is required", meta: {} },
				{ status: 400 },
			);
		}

		const ctx = await buildContext({
			userId,
			missionId: body.missionId ?? undefined,
			houseContext: body.houseContext ?? undefined,
			stormContext: body.stormContext ?? undefined,
			tonePreference: body.tone ?? undefined,
			outputFormat: "plain_text",
			userNotes: body.userNotes ?? undefined,
		});

		const params = {
			houseId,
			exportId: body.exportId ?? null,
			includeStormEvidence: body.includeStormEvidence ?? true,
			includeVisitTimeline: body.includeVisitTimeline ?? true,
			customNotes: body.customNotes ?? null,
		};

		const { system, user } = buildExportSummaryPrompt(ctx, params);
		const result = await generateFromPrompt(system, user);
		const output = parseExportSummaryOutput(
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
