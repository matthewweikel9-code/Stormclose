import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { logger } from "@/lib/logger";

type MetaShape = Record<string, unknown>;

export type ApiEnvelope<T> = {
	data: T | null;
	error: string | null;
	meta: MetaShape;
};

export function successResponse<T>(data: T, meta: MetaShape = {}, status = 200) {
	const payload: ApiEnvelope<T> = {
		data,
		error: null,
		meta: {
			generatedAt: new Date().toISOString(),
			...meta,
		},
	};
	return NextResponse.json(payload, { status });
}

export function errorResponse(message: string, status = 500, meta: MetaShape = {}) {
	const payload: ApiEnvelope<null> = {
		data: null,
		error: message,
		meta: {
			generatedAt: new Date().toISOString(),
			...meta,
		},
	};
	return NextResponse.json(payload, { status });
}

export async function parseJsonBody<T>(request: Request, schema?: ZodSchema<T>): Promise<T> {
	const raw = (await request.json()) as unknown;
	if (!schema) return raw as T;
	return schema.parse(raw);
}

export function handleRouteError(error: unknown, fallbackMessage: string) {
	const message = error instanceof Error ? error.message : fallbackMessage;
	logger.error("api.route.error", {
		message,
		fallbackMessage,
		errorType: error instanceof Error ? error.name : "UnknownError",
	});
	return errorResponse(message, 500);
}
