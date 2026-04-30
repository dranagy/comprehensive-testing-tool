import type { PerformanceMetric, SlaConfig, SlaStatus } from "../../shared/types.js";
import type { SlaValidationResult } from "./types.js";

/**
 * Validate collected performance metrics against SLA thresholds.
 * Uses worst-case values across all metric samples.
 */
export function validateSLA(metrics: PerformanceMetric[], sla: SlaConfig): SlaValidationResult {
  const worstP95 = worst(metrics.map((m) => m.responseTimeP95).filter((v): v is number => v !== null), "max");
  const worstErrorRate = worst(metrics.map((m) => m.errorRate).filter((v): v is number => v !== null), "max");
  const worstThroughput = worst(metrics.map((m) => m.throughputRps).filter((v): v is number => v !== null), "min");

  const checks = {
    responseTimeP95: worstP95 <= sla.responseTimeP95Ms ? ("PASS" as SlaStatus) : ("FAIL" as SlaStatus),
    errorRate: worstErrorRate <= sla.errorRateMax ? ("PASS" as SlaStatus) : ("FAIL" as SlaStatus),
    throughputRps: worstThroughput >= sla.throughputMinRps ? ("PASS" as SlaStatus) : ("FAIL" as SlaStatus),
  };

  const overallStatus: SlaStatus =
    checks.responseTimeP95 === "FAIL" || checks.errorRate === "FAIL" || checks.throughputRps === "FAIL"
      ? "FAIL"
      : "PASS";

  return {
    status: overallStatus,
    checks,
    actual: {
      responseTimeP95: worstP95,
      errorRate: worstErrorRate,
      throughputRps: worstThroughput,
    },
  };
}

function worst(values: number[], mode: "max" | "min"): number {
  if (values.length === 0) {
    return mode === "max" ? 0 : Infinity;
  }
  return mode === "max" ? Math.max(...values) : Math.min(...values);
}
