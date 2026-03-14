import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { buildContext } from "@/lib/ai/buildContext";
import {
	buildFollowUpWriterPrompt,
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
		const { homeownerName, lastInteraction, desiredNextAction } = body;

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

		const ctx = await buildContext({
			userId,
			missionId: body.missionId ?? undefined,
			houseContext: body.houseContext ?? undefined,
			tonePreference: body.tone ?? undefined,
			outputFormat: "plain_text",
			userNotes: body.userNotes ?? undefined,
		});

		const params = {
			situation: body.situation ?? "post_inspection",
			channel: body.channel ?? "text",
			houseId: body.houseId ?? null,
			homeownerName,
			lastInteraction,
			desiredNextAction,
			daysSinceLastContact: body.daysSinceLastContact ?? 1,
			touchNumber: body.touchNumber ?? 1,
			customInstructions: body.customInstructions ?? null,
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
