import { buildContext, type BuildContextOptions } from "@/lib/ai/buildContext";
import type { AiContext } from "@/types/ai-context";

export type AiRequestEnvelope<TParams extends Record<string, unknown>> = {
	context?: Partial<AiContext> | null;
	params?: TParams | null;
} & Record<string, unknown>;

export function extractModuleParams<TParams extends Record<string, unknown>>(
	body: unknown,
): TParams {
	if (
		typeof body === "object" &&
		body !== null &&
		"params" in body &&
		typeof (body as Record<string, unknown>).params === "object" &&
		(body as Record<string, unknown>).params !== null
	) {
		return (body as AiRequestEnvelope<TParams>).params as TParams;
	}

	return (body ?? {}) as TParams;
}

export function extractProvidedContext(body: unknown): Partial<AiContext> | null {
	if (
		typeof body === "object" &&
		body !== null &&
		"context" in body &&
		typeof (body as Record<string, unknown>).context === "object" &&
		(body as Record<string, unknown>).context !== null
	) {
		return (body as AiRequestEnvelope<Record<string, unknown>>).context ?? null;
	}

	return null;
}

export async function resolveAiRequestContext(
	userId: string,
	body: unknown,
	baseOptions: Omit<BuildContextOptions, "userId">,
): Promise<AiContext> {
	const base = await buildContext({ userId, ...baseOptions });
	const provided = extractProvidedContext(body);

	if (!provided) {
		return base;
	}

	return {
		...base,
		...provided,
		companyProfile: provided.companyProfile ?? base.companyProfile,
		stormContext: provided.stormContext ?? base.stormContext,
		houseContext: provided.houseContext ?? base.houseContext,
		missionContext: provided.missionContext ?? base.missionContext,
		repContext: provided.repContext ?? base.repContext,
		tonePreference: provided.tonePreference ?? base.tonePreference,
		outputFormat: provided.outputFormat ?? base.outputFormat,
		userNotes: provided.userNotes ?? base.userNotes,
	};
}
