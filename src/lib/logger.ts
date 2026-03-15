type LogLevel = "info" | "warn" | "error";

type LogPayload = {
	event: string;
	message?: string;
	[key: string]: unknown;
};

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

export const logger = {
	info(event: string, fields: Omit<LogPayload, "event"> = {}) {
		write("info", { event, ...fields });
	},
	warn(event: string, fields: Omit<LogPayload, "event"> = {}) {
		write("warn", { event, ...fields });
	},
	error(event: string, fields: Omit<LogPayload, "event"> = {}) {
		write("error", { event, ...fields });
	},
};
