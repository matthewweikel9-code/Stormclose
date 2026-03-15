import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { extractModuleParams, resolveAiRequestContext } from "@/lib/ai/requestContract";
import { createDocument } from "@/lib/documents/store";
import {
	buildNegotiationCoachPrompt,
	type NegotiationCoachParams,
	parseNegotiationCoachOutput,
} from "@/lib/ai/modules/negotiationCoach";

/**
 * POST /api/ai/negotiation-coach
 * Strategic pricing, scope, and insurance negotiation guidance.
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
		const scenario =
			typeof parsed.scenario === "string"
				? (parsed.scenario as NegotiationCoachParams["scenario"])
				: null;
		const situationDescription =
			typeof parsed.situationDescription === "string" ? parsed.situationDescription : "";

		if (!scenario || !situationDescription) {
			return NextResponse.json(
				{
					data: null,
					error: "scenario and situationDescription are required",
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
			outputFormat: "markdown",
			userNotes: typeof parsed.userNotes === "string" ? parsed.userNotes : undefined,
		});

		const params: NegotiationCoachParams = {
			scenario,
			houseId: typeof parsed.houseId === "string" ? parsed.houseId : null,
			situationDescription,
			homeownerConcern: typeof parsed.homeownerConcern === "string" ? parsed.homeownerConcern : null,
			competitorQuote: typeof parsed.competitorQuote === "number" ? parsed.competitorQuote : null,
			ourQuote: typeof parsed.ourQuote === "number" ? parsed.ourQuote : null,
			insuranceClaimAmount: typeof parsed.insuranceClaimAmount === "number" ? parsed.insuranceClaimAmount : null,
		};

		const { system, user } = buildNegotiationCoachPrompt(ctx, params);
		const result = await generateFromPrompt(system, user);
		const output = parseNegotiationCoachOutput(
			result.content,
			result.model,
			result.usage?.totalTokens ?? 0,
		);
		let savedDocumentId: string | null = null;
		const saveAsDocument = Boolean(parsed.saveAsDocument);
		if (saveAsDocument) {
			const documentContent = [
				`# Negotiation Strategy`,
				"",
				output.strategy,
				"",
				"## Talking Points",
				...output.talkingPoints.map((item) => `- ${item}`),
			].join("\n");

			if (process.env.NODE_ENV === "test") {
				const doc = createDocument({
					type: "rep_field_recap",
					title: "AI Negotiation Strategy",
					contextType: "house",
					contextId: typeof parsed.houseId === "string" ? parsed.houseId : "unknown-house",
					content: documentContent,
					format: "clipboard",
					createdBy: userId,
				});
				savedDocumentId = doc.id;
			} else {
				const supabase = await createClient();
				const { data } = await (supabase.from("documents") as any)
					.insert({
						type: "rep_field_recap",
						title: "AI Negotiation Strategy",
						context_type: "house",
						context_id: typeof parsed.houseId === "string" ? parsed.houseId : null,
						content: documentContent,
						format: "clipboard",
						created_by: userId,
						exported: false,
					})
					.select("id")
					.maybeSingle();
				savedDocumentId = data?.id ?? null;
			}
		}
		const cost = estimateUsageCostUsd(result);

		return NextResponse.json({
			data: output,
			error: null,
			meta: {
				timestamp: new Date().toISOString(),
				model: result.model,
				tokenCount: result.usage?.totalTokens ?? 0,
				estimatedCostUsd: cost,
				savedDocumentId,
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
