import { describe, it, expect } from "vitest";
import { validateSLA } from "../../../src/modules/performance/sla-validator.js";
import type { PerformanceMetric, SlaConfig } from "../../../src/shared/types.js";

function makeMetric(overrides: Partial<PerformanceMetric> & { id: string; sessionId: string }): PerformanceMetric {
  return {
    timestamp: new Date().toISOString(),
    elapsedSeconds: 10,
    concurrentUsers: 50,
    responseTimeP50: 100,
    responseTimeP90: 200,
    responseTimeP95: 300,
    responseTimeP99: 500,
    throughputRps: 100,
    errorRate: 0.01,
    slaStatus: "NOT_CONFIGURED",
    ...overrides,
  };
}

describe("SLA Validator", () => {
  it("passes when all thresholds are met", () => {
    const metrics: PerformanceMetric[] = [
      makeMetric({ id: "m-001", sessionId: "s-001" }),
    ];
    const sla: SlaConfig = {
      responseTimeP95Ms: 500,
      errorRateMax: 0.05,
      throughputMinRps: 50,
    };

    const result = validateSLA(metrics, sla);

    expect(result.status).toBe("PASS");
    expect(result.checks.responseTimeP95).toBe("PASS");
    expect(result.checks.errorRate).toBe("PASS");
    expect(result.checks.throughputRps).toBe("PASS");
  });

  it("fails when p95 response time exceeds threshold", () => {
    const metrics: PerformanceMetric[] = [
      makeMetric({ id: "m-001", sessionId: "s-001", responseTimeP95: 600 }),
    ];
    const sla: SlaConfig = {
      responseTimeP95Ms: 500,
      errorRateMax: 0.05,
      throughputMinRps: 50,
    };

    const result = validateSLA(metrics, sla);

    expect(result.status).toBe("FAIL");
    expect(result.checks.responseTimeP95).toBe("FAIL");
  });

  it("fails when error rate exceeds threshold", () => {
    const metrics: PerformanceMetric[] = [
      makeMetric({ id: "m-001", sessionId: "s-001", errorRate: 0.1 }),
    ];
    const sla: SlaConfig = {
      responseTimeP95Ms: 500,
      errorRateMax: 0.05,
      throughputMinRps: 50,
    };

    const result = validateSLA(metrics, sla);

    expect(result.status).toBe("FAIL");
    expect(result.checks.errorRate).toBe("FAIL");
  });

  it("fails when throughput is below minimum", () => {
    const metrics: PerformanceMetric[] = [
      makeMetric({ id: "m-001", sessionId: "s-001", throughputRps: 30 }),
    ];
    const sla: SlaConfig = {
      responseTimeP95Ms: 500,
      errorRateMax: 0.05,
      throughputMinRps: 50,
    };

    const result = validateSLA(metrics, sla);

    expect(result.status).toBe("FAIL");
    expect(result.checks.throughputRps).toBe("FAIL");
  });

  it("uses worst-case values across all metric samples", () => {
    const metrics: PerformanceMetric[] = [
      makeMetric({ id: "m-001", sessionId: "s-001", responseTimeP95: 200 }),
      makeMetric({ id: "m-002", sessionId: "s-001", responseTimeP95: 700 }),
      makeMetric({ id: "m-003", sessionId: "s-001", responseTimeP95: 300 }),
    ];
    const sla: SlaConfig = {
      responseTimeP95Ms: 500,
      errorRateMax: 0.05,
      throughputMinRps: 50,
    };

    const result = validateSLA(metrics, sla);

    // The worst p95 (700) exceeds the threshold
    expect(result.status).toBe("FAIL");
    expect(result.checks.responseTimeP95).toBe("FAIL");
  });

  it("passes with empty metrics when SLA is configured", () => {
    const result = validateSLA([], {
      responseTimeP95Ms: 500,
      errorRateMax: 0.05,
      throughputMinRps: 50,
    });

    expect(result.status).toBe("PASS");
    expect(result.checks.responseTimeP95).toBe("PASS");
    expect(result.checks.errorRate).toBe("PASS");
    expect(result.checks.throughputRps).toBe("PASS");
  });

  it("reports actual values alongside pass/fail", () => {
    const metrics: PerformanceMetric[] = [
      makeMetric({ id: "m-001", sessionId: "s-001", responseTimeP95: 600, errorRate: 0.1, throughputRps: 30 }),
    ];
    const sla: SlaConfig = {
      responseTimeP95Ms: 500,
      errorRateMax: 0.05,
      throughputMinRps: 50,
    };

    const result = validateSLA(metrics, sla);

    expect(result.actual.responseTimeP95).toBe(600);
    expect(result.actual.errorRate).toBe(0.1);
    expect(result.actual.throughputRps).toBe(30);
  });
});
