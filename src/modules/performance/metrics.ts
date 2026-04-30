import type { PerformanceMetric } from "../../shared/types.js";

export interface PercentileResult {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

/**
 * Compute percentile values from a sorted array of numbers.
 */
export function computePercentiles(values: number[]): PercentileResult {
  if (values.length === 0) {
    return { p50: 0, p90: 0, p95: 0, p99: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);

  return {
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 1) return sorted[0];
  const index = (pct / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const fraction = index - lower;
  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

/**
 * Aggregate raw response times into a single PerformanceMetric with computed percentiles.
 */
export function aggregateMetrics(
  responseTimes: number[],
  totalRequests: number,
  errorCount: number,
  elapsedSeconds: number,
  concurrentUsers: number,
  sessionId: string,
  metricId: string,
): PerformanceMetric {
  const percentiles = computePercentiles(responseTimes);
  const throughputRps = elapsedSeconds > 0 ? totalRequests / elapsedSeconds : 0;
  const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

  return {
    id: metricId,
    sessionId,
    timestamp: new Date().toISOString(),
    elapsedSeconds,
    concurrentUsers,
    responseTimeP50: percentiles.p50,
    responseTimeP90: percentiles.p90,
    responseTimeP95: percentiles.p95,
    responseTimeP99: percentiles.p99,
    throughputRps,
    errorRate,
    slaStatus: "NOT_CONFIGURED",
  };
}
