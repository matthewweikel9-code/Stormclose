type AnyRecord = Record<string, unknown>;

type ResolveContextOptions = {
	missionId?: string;
	tonePreference?: Record<string, unknown>;
	outputFormat?: string;
	userNotes?: string;
};

export function extractModuleParams<T extends AnyRecord>(body: unknown): T {
	if (!body || typeof body !== "object") {
		return {} as T;
	}

	const params = (body as AnyRecord).params;
	if (!params || typeof params !== "object") {
		return {} as T;
	}

	return params as T;
}

export async function resolveAiRequestContext(
	userId: string,
	body: unknown,
	options: ResolveContextOptions = {}
): Promise<AnyRecord> {
	const requestBody = (body && typeof body === "object" ? body : {}) as AnyRecord;
	const context = requestBody.context && typeof requestBody.context === "object" ? requestBody.context : {};

	return {
		userId,
		context,
		missionId: options.missionId ?? null,
		tonePreference: options.tonePreference ?? null,
		outputFormat: options.outputFormat ?? "markdown",
		userNotes: options.userNotes ?? null,
		requestedAt: new Date().toISOString(),
	};
}
