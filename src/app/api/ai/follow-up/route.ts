import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { extractModuleParams, resolveAiRequestContext } from "@/lib/ai/requestContract";
import {
	buildFollowUpWriterPrompt,
	type FollowUpWriterParams,
	parseFollowUpWriterOutput,
} from "@/lib/ai/modules/followUpWriter";

/**
 * POST /api/ai/follow-up
 * Drafts high-converting follow-up messages across text, email, and voicemail.
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
		const homeownerName =
			typeof parsed.homeownerName === "string" ? parsed.homeownerName : "";
		const lastInteraction =
			typeof parsed.lastInteraction === "string" ? parsed.lastInteraction : "";
		const desiredNextAction =
			typeof parsed.desiredNextAction === "string" ? parsed.desiredNextAction : "";

		if (!homeownerName || !lastInteraction || !desiredNextAction) {
			return NextResponse.json(
				{
					data: null,
					error: "homeownerName, lastInteraction, and desiredNextAction are required",
					meta: {},
				},
				{ status: 400 },
			);
		}

		const ctx = await resolveAiRequestContext(userId, body, {
			missionId: typeof parsed.missionId === "string" ? parsed.missionId : undefined,
			houseContext:
				typeof parsed.houseContext === "object" && parsed.houseContext !== null
					? (parsed.houseContext as never)
					: undefined,
			tonePreference:
				typeof parsed.tone === "object" && parsed.tone !== null
					? (parsed.tone as never)
					: undefined,
			outputFormat: "text",
			userNotes: typeof parsed.userNotes === "string" ? parsed.userNotes : undefined,
		});

		const params: FollowUpWriterParams = {
			situation:
				typeof parsed.situation === "string"
					? (parsed.situation as FollowUpWriterParams["situation"])
					: "post_inspection",
			channel:
				typeof parsed.channel === "string"
					? (parsed.channel as FollowUpWriterParams["channel"])
					: "text",
			houseId: typeof parsed.houseId === "string" ? parsed.houseId : null,
			homeownerName,
			lastInteraction,
			desiredNextAction,
			daysSinceLastContact:
				typeof parsed.daysSinceLastContact === "number" ? parsed.daysSinceLastContact : 1,
			touchNumber: typeof parsed.touchNumber === "number" ? parsed.touchNumber : 1,
			customInstructions:
				typeof parsed.customInstructions === "string" ? parsed.customInstructions : null,
		};

		const { system, user } = buildFollowUpWriterPrompt(ctx, params);
		const result = await generateFromPrompt(system, user);
		const output = parseFollowUpWriterOutput(
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
