import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { extractModuleParams, resolveAiRequestContext } from "@/lib/ai/requestContract";
import {
	buildOpportunitySummaryPrompt,
	type OpportunitySummaryParams,
	parseOpportunitySummaryOutput,
} from "@/lib/ai/modules/opportunitySummary";

/**
 * POST /api/ai/opportunity-summary
 * Generates a comprehensive opportunity writeup for a qualified prospect.
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
		const houseId = typeof parsed.houseId === "string" ? parsed.houseId : "";

		if (!houseId) {
			return NextResponse.json(
				{ data: null, error: "houseId is required", meta: {} },
				{ status: 400 },
			);
		}

		const ctx = await resolveAiRequestContext(userId, body, {
			missionId: typeof parsed.missionId === "string" ? parsed.missionId : undefined,
			houseContext:
				typeof parsed.houseContext === "object" && parsed.houseContext !== null
					? (parsed.houseContext as never)
					: undefined,
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

		const params: OpportunitySummaryParams = {
			houseId,
			includeInsuranceContext: Boolean(parsed.includeInsuranceContext ?? true),
			includeStormEvidence: Boolean(parsed.includeStormEvidence ?? true),
			customSections: Array.isArray(parsed.customSections)
				? parsed.customSections.map(String)
				: [],
			outputFormat:
				typeof parsed.outputFormat === "string"
					? (parsed.outputFormat as OpportunitySummaryParams["outputFormat"])
					: "markdown",
		};

		const { system, user } = buildOpportunitySummaryPrompt(ctx, params);
		const result = await generateFromPrompt(system, user);
		const output = parseOpportunitySummaryOutput(
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
