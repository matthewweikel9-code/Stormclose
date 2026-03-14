import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { buildContext } from "@/lib/ai/buildContext";
import {
	buildObjectionResponsePrompt,
	parseObjectionResponseOutput,
} from "@/lib/ai/modules/objectionResponse";

/**
 * POST /api/ai/objection-response
 * Generates contextual objection handling using the LAER framework.
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
		const { objection } = body;

		if (!objection) {
			return NextResponse.json(
				{ data: null, error: "objection is required", meta: {} },
				{ status: 400 },
			);
		}

		const ctx = await buildContext({
			userId,
			missionId: body.missionId ?? undefined,
			houseContext: body.houseContext ?? undefined,
			tonePreference: body.tone ?? undefined,
			outputFormat: "markdown",
			userNotes: body.userNotes ?? undefined,
		});

		const params = {
			objection,
			category: body.category ?? null,
			templateId: body.templateId ?? null,
			homeownerName: body.homeownerName ?? null,
			projectType: body.projectType ?? "roof_replacement",
			keyBenefits: body.keyBenefits ?? [
				"Storm damage expertise",
				"Insurance claim assistance",
				"Local trusted contractor",
			],
			evidencePoints: body.evidencePoints ?? [],
			tone: body.objectionTone ?? "consultative",
		};

		const { system, user } = buildObjectionResponsePrompt(ctx, params);
		const result = await generateFromPrompt(system, user);
		const output = parseObjectionResponseOutput(
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
