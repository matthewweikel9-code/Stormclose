import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { buildContext } from "@/lib/ai/buildContext";
import {
	buildMissionCopilotPrompt,
	parseMissionCopilotOutput,
} from "@/lib/ai/modules/missionCopilot";

/**
 * POST /api/ai/mission-copilot
 * Real-time AI suggestions during active missions.
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
		const { missionId, suggestionType, currentStopId, repQuestion } = body;

		if (!missionId || !suggestionType) {
			return NextResponse.json(
				{ data: null, error: "missionId and suggestionType are required", meta: {} },
				{ status: 400 },
			);
		}

		const ctx = await buildContext({
			userId,
			missionId,
			tonePreference: body.tone ?? undefined,
			outputFormat: "markdown",
			userNotes: body.userNotes ?? undefined,
		});

		const params = {
			suggestionType,
			missionId,
			currentStopId: currentStopId ?? null,
			repQuestion: repQuestion ?? null,
		};

		const { system, user } = buildMissionCopilotPrompt(ctx, params);
		const result = await generateFromPrompt(system, user);
		const output = parseMissionCopilotOutput(
			result.content,
			params,
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
