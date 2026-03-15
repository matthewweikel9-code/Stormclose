import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { extractModuleParams, resolveAiRequestContext } from "@/lib/ai/requestContract";
import { createDocument } from "@/lib/documents/store";
import {
	buildObjectionResponsePrompt,
	type ObjectionResponseParams,
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
		const parsed = extractModuleParams<Record<string, unknown>>(body);
		const objection = typeof parsed.objection === "string" ? parsed.objection : "";

		if (!objection) {
			return NextResponse.json(
				{ data: null, error: "objection is required", meta: {} },
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

		const params: ObjectionResponseParams = {
			objection,
			category: typeof parsed.category === "string" ? (parsed.category as ObjectionResponseParams["category"]) : null,
			templateId: typeof parsed.templateId === "string" ? parsed.templateId : null,
			homeownerName: typeof parsed.homeownerName === "string" ? parsed.homeownerName : null,
			projectType: typeof parsed.projectType === "string" ? parsed.projectType : "roof_replacement",
			keyBenefits: Array.isArray(parsed.keyBenefits)
				? parsed.keyBenefits.map(String)
				: [
				"Storm damage expertise",
				"Insurance claim assistance",
				"Local trusted contractor",
			],
			evidencePoints: Array.isArray(parsed.evidencePoints)
				? parsed.evidencePoints.map(String)
				: [],
			tone:
				typeof parsed.objectionTone === "string"
					? (parsed.objectionTone as ObjectionResponseParams["tone"])
					: "consultative",
		};

		const { system, user } = buildObjectionResponsePrompt(ctx, params);
		const result = await generateFromPrompt(system, user);
		const output = parseObjectionResponseOutput(
			result.content,
			result.model,
			result.usage?.totalTokens ?? 0,
		);
		let savedDocumentId: string | null = null;
		const saveAsDocument = Boolean(parsed.saveAsDocument);
		if (saveAsDocument) {
			if (process.env.NODE_ENV === "test") {
				const doc = createDocument({
					type: "claim_explanation_letter",
					title: "AI Objection Response",
					contextType: "house",
					contextId: typeof parsed.houseId === "string" ? parsed.houseId : "unknown-house",
					content: output.response,
					format: "clipboard",
					createdBy: userId,
				});
				savedDocumentId = doc.id;
			} else {
				const supabase = await createClient();
				const { data } = await (supabase.from("documents") as any)
					.insert({
						type: "claim_explanation_letter",
						title: "AI Objection Response",
						context_type: "house",
						context_id: typeof parsed.houseId === "string" ? parsed.houseId : null,
						content: output.response,
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
