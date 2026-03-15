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
};

export type { MetricTags };
