# Observability & Metrics Plan

This document outlines the strategy for monitoring the Stormclose backend and gathering operational intelligence via business metrics.

## Supported Metrics

We emit structured JSON logs using the `MetricsEmitter` (`src/lib/metrics.ts`), which acts as an application-level counter. These logs can be easily parsed by APM platforms like Datadog, CloudWatch, or Grafana/Loki.

Current tracked metrics:
1. `mission_creation_success` - Track successful completions of the complex mission creation transaction.
2. `corelogic_cache_miss` - High occurrence indicates we are paying to fetch fresh parcel data often. 
3. `api_error_rate` - Generalized API error counter, grouped by `route`, `status`, and `type` labels.
4. `route_provider_fallbacks` - Tracks how often we fallback from Google Directions API to the local TSP solver.

## Emit Points

- `mission_creation_success`: emitted in `src/services/missionService.ts` after transactional mission create succeeds.
- `corelogic_cache_miss`: emitted in `src/integrations/corelogicCachedClient.ts` whenever cache requires a refresh (stale or below threshold).
- `api_error_rate`: emitted in `src/lib/api-middleware.ts` for thrown errors and explicit `withStatus(...)` responses with status >= 400.
- `route_provider_fallbacks`: emitted in `src/services/routeService.ts` when fallback path is used.

## Prometheus Pushgateway
We also support accumulating and periodic flushing of counters to a **Prometheus Pushgateway**. Provide the `PROMETHEUS_PUSHGATEWAY_URL` environment variable to enable pushes.

---

## Sample Dashboard Queries

### 1. JSON Structured Log Queries (e.g. Datadog / CloudWatch / Loki)

**Find Corelogic Cache Misses:**
```logql
# Loki
{job="stormclose-api"} | json | type="metric" | metric_name="corelogic_cache_miss"

# Datadog
@type:metric @metric_name:corelogic_cache_miss
```

**Find High Route Fallbacks:**
```json
// CloudWatch Logs Insights
fields @timestamp, metric_name, labels.reason
| filter type = "metric" and metric_name = "route_provider_fallbacks"
| stats sum(metric_value) as TotalFallbacks by labels.reason
| sort TotalFallbacks desc
```

**Find API Errors by Route:**
```json
// CloudWatch Logs Insights
fields @timestamp, labels.route, labels.status, labels.type
| filter type = "metric" and metric_name = "api_error_rate"
| stats sum(metric_value) as ErrorCount by labels.route, labels.status, labels.type
| sort ErrorCount desc
```

### 2. Prometheus (PromQL)

**Mission Creation Rate (per 5 minutes):**
```promql
rate(mission_creation_success_total[5m])
```

**Route Provider Fallback Ratio:**
```promql
sum(rate(route_provider_fallbacks_total[1h])) by (reason) 
/ 
sum(rate(route_provider_success_total[1h]))
```

**API Error Rate Alert:**
```promql
sum(rate(api_error_rate_total[5m])) by (route, status, type)
```

**CoreLogic Cache Miss Rate:**
```promql
sum(rate(corelogic_cache_miss_total[15m])) by (reason)
```
