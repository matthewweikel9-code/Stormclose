type LogLevel = "info" | "warn" | "error";

type LogPayload = {
	event: string;
	message?: string;
	[key: string]: unknown;
};

type LoggerFields = Omit<LogPayload, "event">;

function generateCorrelationId() {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function extractCorrelationId(headers?: Headers | null) {
	if (!headers) return generateCorrelationId();
	return (
		headers.get("x-correlation-id") ??
		headers.get("x-request-id") ??
		headers.get("x-vercel-id") ??
		generateCorrelationId()
	);
}

function write(level: LogLevel, payload: LogPayload) {
	const entry = {
		timestamp: new Date().toISOString(),
		level,
		...payload,
	};

	const serialized = JSON.stringify(entry);
	if (level === "error") {
		console.error(serialized);
		return;
	}
	if (level === "warn") {
		console.warn(serialized);
		return;
	}
	console.info(serialized);
}

function scopedLogger(scopeFields: Record<string, unknown>) {
	return {
		info(event: string, fields: LoggerFields = {}) {
			write("info", { event, ...scopeFields, ...fields });
		},
		warn(event: string, fields: LoggerFields = {}) {
			write("warn", { event, ...scopeFields, ...fields });
		},
		error(event: string, fields: LoggerFields = {}) {
			write("error", { event, ...scopeFields, ...fields });
		},
	};
}

export const logger = {
	info(event: string, fields: LoggerFields = {}) {
		write("info", { event, ...fields });
	},
	warn(event: string, fields: LoggerFields = {}) {
		write("warn", { event, ...fields });
	},
	error(event: string, fields: LoggerFields = {}) {
		write("error", { event, ...fields });
	},
	withContext(fields: Record<string, unknown>) {
		return scopedLogger(fields);
	},
	fromRequest(request: Request, fields: Record<string, unknown> = {}) {
		const correlationId = extractCorrelationId(request.headers);
		return {
			correlationId,
			log: scopedLogger({ correlationId, ...fields }),
		};
	},
};
