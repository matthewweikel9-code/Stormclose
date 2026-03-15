import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import { extractModuleParams, resolveAiRequestContext } from "@/lib/ai/requestContract";
import {
	buildDailyBriefPrompt,
	parseDailyBriefOutput,
} from "@/lib/ai/modules/dailyBrief";
import { errorResponse, successResponse } from "@/utils/api-response";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/metrics";
import { isFeatureEnabled } from "@/lib/featureFlag";

const DailyBriefBodySchema = z.object({
	context: z.unknown().optional().nullable(),
	params: z
		.object({
			briefDate: z.string().optional(),
			focusAreas: z.string().optional().nullable(),
			force: z.boolean().optional(),
			missionId: z.string().optional(),
			tone: z.record(z.unknown()).optional(),
			outputFormat: z.string().optional(),
			userNotes: z.string().optional(),
		})
		.passthrough()
		.optional(),
}).passthrough();

/**
 * POST /api/ai/daily-brief
 * Generates a morning operations brief.
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
			return errorResponse("Unauthorized", 401);
		}

		if (process.env.NODE_ENV !== "test") {
			const aiEnabled = await isFeatureEnabled(userId, "ai.enabled");
			if (!aiEnabled) {
				return errorResponse("AI is temporarily disabled", 503);
			}

			const moduleEnabled = await isFeatureEnabled(userId, "ai.daily_brief.enabled");
			if (!moduleEnabled) {
				return errorResponse("Daily Brief module is disabled", 503);
			}
		}

		const body = DailyBriefBodySchema.parse(await request.json());
		const params = extractModuleParams<Record<string, unknown>>(body);
		const briefDate =
			typeof params.briefDate === "string"
				? params.briefDate
				: new Date().toISOString().split("T")[0];
		const focusAreas = typeof params.focusAreas === "string" ? params.focusAreas : null;
		const force = Boolean(params.force ?? false);

		const ctx = await resolveAiRequestContext(userId, body, {
			missionId: typeof params.missionId === "string" ? params.missionId : undefined,
			tonePreference:
				typeof params.tone === "object" && params.tone !== null
					? (params.tone as never)
					: undefined,
			outputFormat: typeof params.outputFormat === "string" ? (params.outputFormat as never) : "markdown",
			userNotes: typeof params.userNotes === "string" ? params.userNotes : undefined,
		});

		const { system, user } = buildDailyBriefPrompt(ctx, {
			briefDate,
			focusAreas,
			force,
		});

		const result = await generateFromPrompt(system, user);
		const output = parseDailyBriefOutput(
			result.content,
			result.model,
			result.usage?.totalTokens ?? 0,
		);
		const cost = estimateUsageCostUsd(result);

		const latencyMs = Date.now() - start;
		metrics.increment("ai_call_duration_ms", latencyMs, {
			module: "daily_brief",
			model: result.model,
		});
		metrics.increment("api_latency_ms", latencyMs, {
			route: "/api/ai/daily-brief",
			method: "POST",
		});

		logger.info("ai.daily_brief.generated", {
			userId,
			model: result.model,
			tokenCount: result.usage?.totalTokens ?? 0,
			latencyMs,
		});

		return successResponse(output, {
			timestamp: new Date().toISOString(),
			model: result.model,
			tokenCount: result.usage?.totalTokens ?? 0,
			estimatedCostUsd: cost,
			latencyMs,
		});
	} catch (err) {
		if (err instanceof z.ZodError) {
			return errorResponse("Invalid request payload", 400, { details: err.flatten() });
		}
		const message = err instanceof Error ? err.message : "Internal server error";
		const lower = message.toLowerCase();
		const providerDown = lower.includes("openai") || lower.includes("timeout") || lower.includes("rate");
		if (providerDown && process.env.NODE_ENV !== "test") {
			logger.warn("ai.daily_brief.fallback", { message });
			return successResponse(
				{
					summary:
						"AI provider is temporarily unavailable. Continue with current mission priorities and refresh in a few minutes.",
					highlights: [
						{ category: "mission", text: "Verify active missions and rep coverage.", href: "/dashboard/missions" },
						{ category: "export", text: "Review exports queue for pending handoffs.", href: "/dashboard/exports" },
					],
					generatedAt: new Date().toISOString(),
					model: "fallback",
					tokenCount: 0,
				},
				{ fallback: true, warning: message }
			);
		}
		logger.error("ai.daily_brief.error", {
			message,
			latencyMs: Date.now() - start,
		});
		return errorResponse(message, 500, { timestamp: new Date().toISOString() });
	}
}
