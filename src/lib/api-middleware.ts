import { NextResponse } from "next/server";

type RequestLike = Request & {
	nextUrl?: { pathname: string };
	method?: string;
};

export type ApiErrorBody = {
	code: string;
	message: string;
};

export type ApiResponse<T = unknown> =
	| { success: true; data: T; error?: never }
	| { success: false; data?: never; error: ApiErrorBody };

export type StatusBody<T = unknown> = {
	status: number;
	body: T;
};

export class HttpError extends Error {
	statusCode: number;
	code: string;

	constructor(statusCode: number, code: string, message: string) {
		super(message);
		this.name = "HttpError";
		this.statusCode = statusCode;
		this.code = code;
	}
}

export function ok<T>(data: T): ApiResponse<T> {
	return { success: true, data };
}

export function fail(code: string, message: string): ApiResponse<never> {
	return { success: false, error: { code, message } };
}

export function withStatus<T>(status: number, body: T): StatusBody<T> {
	return { status, body };
}

type LogPayload = {
	timestamp: string;
	route: string;
	userId: string | null;
	method?: string;
};

export function logRequest(payload: Omit<LogPayload, "timestamp">) {
	const event: LogPayload = {
		timestamp: new Date().toISOString(),
		route: payload.route,
		userId: payload.userId ?? null,
		method: payload.method,
	};

	console.info(JSON.stringify(event));
}

export function toHttpError(error: unknown): HttpError {
	if (error instanceof HttpError) {
		return error;
	}

	if (error instanceof SyntaxError) {
		return new HttpError(400, "BAD_REQUEST", "Malformed JSON body");
	}

	if (error instanceof TypeError) {
		return new HttpError(400, "BAD_REQUEST", error.message || "Invalid request");
	}

	if (error && typeof error === "object") {
		const obj = error as Record<string, unknown>;
		const statusCode =
			typeof obj.statusCode === "number"
				? obj.statusCode
				: typeof obj.status === "number"
					? obj.status
					: undefined;
		const code = typeof obj.code === "string" ? obj.code : "INTERNAL_ERROR";
		const message =
			typeof obj.message === "string" ? obj.message : "Internal server error";
		const name = typeof obj.name === "string" ? obj.name : "";

		if (statusCode) {
			return new HttpError(statusCode, code, message);
		}

		if (name === "ZodError" || name === "ValidationError") {
			return new HttpError(400, "VALIDATION_ERROR", message);
		}

		if (name === "UnauthorizedError" || name === "AuthError") {
			return new HttpError(401, "UNAUTHORIZED", message || "Unauthorized");
		}

		if (name === "ForbiddenError") {
			return new HttpError(403, "FORBIDDEN", message || "Forbidden");
		}

		if (name === "NotFoundError") {
			return new HttpError(404, "NOT_FOUND", message || "Not found");
		}
	}

	return new HttpError(500, "INTERNAL_ERROR", "Internal server error");
}

type HandlerContext = {
	setUserId: (userId: string | null | undefined) => void;
};

type HandleRouteOptions = {
	route?: string;
};

function isStatusBody(value: unknown): value is StatusBody {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Record<string, unknown>;
	return typeof candidate.status === "number" && "body" in candidate;
}

export async function handleNextRoute(
	request: RequestLike,
	handler: (context: HandlerContext) => Promise<Response | StatusBody | ApiResponse | unknown>,
	options?: HandleRouteOptions
): Promise<Response> {
	let userId: string | null = null;
	const route = options?.route || request.nextUrl?.pathname || new URL(request.url).pathname;

	try {
		const result = await handler({
			setUserId: (id) => {
				userId = id ?? null;
			},
		});

		logRequest({ route, userId, method: request.method });

		if (result instanceof Response) {
			return result;
		}

		if (isStatusBody(result)) {
			return NextResponse.json(result.body, { status: result.status });
		}

		return NextResponse.json(result);
	} catch (error) {
		logRequest({ route, userId, method: request.method });
		const mapped = toHttpError(error);
		return NextResponse.json(fail(mapped.code, mapped.message), { status: mapped.statusCode });
	}
}

type ExpressRequest = {
	originalUrl?: string;
	url?: string;
	method?: string;
	headers?: Record<string, unknown>;
	user?: { id?: string };
};

type ExpressResponse = {
	headersSent?: boolean;
	status: (code: number) => ExpressResponse;
	json: (body: unknown) => unknown;
};

type ExpressNext = (error?: unknown) => void;

export function expressRequestLogger(getUserId?: (req: ExpressRequest) => string | null | undefined) {
	return (req: ExpressRequest, _res: ExpressResponse, next: ExpressNext): void => {
		const headerUserId = req.headers?.["x-user-id"];
		const userId =
			getUserId?.(req) ??
			req.user?.id ??
			(typeof headerUserId === "string" ? headerUserId : null);

		logRequest({
			route: req.originalUrl || req.url || "unknown",
			userId,
			method: req.method,
		});

		next();
	};
}

export function expressAsyncHandler<T>(
	handler: (req: ExpressRequest, res: ExpressResponse) => Promise<T | StatusBody<T>>
) {
	return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext): Promise<void> => {
		try {
			const result = await handler(req, res);
			if (res.headersSent) return;

			if (isStatusBody(result)) {
				res.status(result.status).json(result.body);
				return;
			}

			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};
}

export function expressErrorHandler(error: unknown, _req: ExpressRequest, res: ExpressResponse, _next: ExpressNext): void {
	const mapped = toHttpError(error);
	res.status(mapped.statusCode).json(fail(mapped.code, mapped.message));
}

type FastifyRequest = {
	routerPath?: string;
	url?: string;
	method?: string;
	headers?: Record<string, unknown>;
	user?: { id?: string };
};

type FastifyReply = {
	sent?: boolean;
	code: (statusCode: number) => FastifyReply;
	send: (body: unknown) => unknown;
};

export function fastifyRequestLogger(getUserId?: (request: FastifyRequest) => string | null | undefined) {
	return (request: FastifyRequest, _reply: FastifyReply, done: (error?: Error) => void): void => {
		const headerUserId = request.headers?.["x-user-id"];
		const userId =
			getUserId?.(request) ??
			request.user?.id ??
			(typeof headerUserId === "string" ? headerUserId : null);

		logRequest({
			route: request.routerPath || request.url || "unknown",
			userId,
			method: request.method,
		});

		done();
	};
}

export function fastifyHandler<T>(handler: (request: FastifyRequest, reply: FastifyReply) => Promise<T | StatusBody<T>>) {
	return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
		try {
			const result = await handler(request, reply);
			if (reply.sent) return;

			if (isStatusBody(result)) {
				reply.code(result.status).send(result.body);
				return;
			}

			reply.code(200).send(result);
		} catch (error) {
			const mapped = toHttpError(error);
			reply.code(mapped.statusCode).send(fail(mapped.code, mapped.message));
		}
	};
}

export function fastifyErrorHandler(error: unknown, _request: FastifyRequest, reply: FastifyReply): void {
	const mapped = toHttpError(error);
	reply.code(mapped.statusCode).send(fail(mapped.code, mapped.message));
}