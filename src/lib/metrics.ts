export interface MetricLabels {
  [key: string]: string | number | boolean;
}

type CounterSample = {
  metricName: string;
  labels: MetricLabels;
  value: number;
};

export class MetricsEmitter {
  private counters = new Map<string, CounterSample>();

  private normalizeMetricName(name: string): string {
    return name.trim().replace(/[^a-zA-Z0-9_:]/g, "_");
  }

  private toCounterKey(name: string, labels: MetricLabels): string {
    const sortedEntries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    const labelSignature = sortedEntries.map(([key, value]) => `${key}:${String(value)}`).join("|");
    return `${name}::${labelSignature}`;
  }

  private toPrometheusLabelString(labels: MetricLabels): string {
    const sortedEntries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    if (sortedEntries.length === 0) {
      return "";
    }

    const escaped = sortedEntries.map(([key, value]) => {
      const safeKey = key.replace(/[^a-zA-Z0-9_]/g, "_");
      const safeValue = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `${safeKey}="${safeValue}"`;
    });

    return `{${escaped.join(",")}}`;
  }

  /**
   * Increment a counter metric.
   * Emits a structured JSON log that can be ingested by Datadog, CloudWatch, etc.
   */
  increment(name: string, value = 1, labels: MetricLabels = {}) {
    const metricName = this.normalizeMetricName(name);
    const counterKey = this.toCounterKey(metricName, labels);
    const existing = this.counters.get(counterKey);
    const nextValue = (existing?.value ?? 0) + value;

    this.counters.set(counterKey, {
      metricName,
      labels,
      value: nextValue,
    });

    // Emitting structured log for immediate APM parsing
    console.log(JSON.stringify({
      type: "metric",
      metric_name: metricName,
      metric_value: value,
      counter_total: nextValue,
      labels,
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Optional: Push accumulated metrics to a Prometheus PushGateway
   */
  async pushToPrometheus(pushGatewayUrl?: string, jobName = "stormclose-api") {
    const url = pushGatewayUrl || process.env.PROMETHEUS_PUSHGATEWAY_URL;
    if (!url) return;

    let payload = "";
    for (const sample of this.counters.values()) {
      const prometheusMetric = sample.metricName.endsWith("_total")
        ? sample.metricName
        : `${sample.metricName}_total`;
      const labelStr = this.toPrometheusLabelString(sample.labels);

      payload += `# TYPE ${prometheusMetric} counter\n`;
      payload += `${prometheusMetric}${labelStr} ${sample.value}\n`;
    }

    try {
      await fetch(`${url}/metrics/job/${jobName}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: payload
      });
    } catch (error) {
      console.warn("[MetricsEmitter] Failed to push metrics to Prometheus Gateway", error);
    }
  }

  // Used for testing isolation
  _clear() {
    this.counters.clear();
  }
}

export const metrics = new MetricsEmitter();
