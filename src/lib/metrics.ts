type MetricTags = Record<string, string | number | boolean | null | undefined>;

type IncrementMetricInput = {
	name: string;
	value: number;
	tags?: MetricTags;
	timestamp: string;
};

function parseEnvBoolean(value: string | undefined): boolean {
	if (!value) return false;
	const normalized = value.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function emitMetric(payload: IncrementMetricInput) {
	if (!parseEnvBoolean(process.env.METRICS_ENABLED) && process.env.NODE_ENV === "production") {
		return;
	}

	console.info(
		JSON.stringify({
			event: "metric.increment",
			...payload,
		})
	);
}

function scopedMetrics(baseTags: MetricTags) {
	return {
		increment(name: string, value = 1, tags?: MetricTags) {
			if (!name) return;
			emitMetric({
				name,
				value,
				tags: { ...baseTags, ...(tags ?? {}) },
				timestamp: new Date().toISOString(),
			});
		},
	};
}

function getCorrelationId(headers?: Headers | null) {
	if (!headers) return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	return (
		headers.get("x-correlation-id") ??
		headers.get("x-request-id") ??
		headers.get("x-vercel-id") ??
		`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
	);
}

export const metrics = {
	increment(name: string, value = 1, tags?: MetricTags) {
		if (!name) return;
		emitMetric({
			name,
			value,
			tags,
			timestamp: new Date().toISOString(),
		});
	},
	withTags(tags: MetricTags) {
		return scopedMetrics(tags);
	},
	fromRequest(request: Request, tags: MetricTags = {}) {
		const correlationId = getCorrelationId(request.headers);
		return {
			correlationId,
			metric: scopedMetrics({ ...tags, correlationId }),
		};
	},
};

export type { MetricTags };
