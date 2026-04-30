import type { PerformanceConfig, SlaConfig, PerformanceMetric, SlaStatus } from "../../shared/types.js";

export interface LoadConfig {
  virtualUsers: number;
  rampUpSeconds: number;
  durationSeconds: number;
  thinkTimeMs?: number;
}

export interface ArtilleryScenario {
  config: {
    target: string;
    phases: Array<{
      duration: number;
      arrivalRate: number;
      rampTo?: number;
    }>;
  };
  scenarios: Array<{
    name: string;
    flow: Array<Record<string, unknown>>;
  }>;
}

export interface SlaValidationResult {
  status: SlaStatus;
  checks: {
    responseTimeP95: SlaStatus;
    errorRate: SlaStatus;
    throughputRps: SlaStatus;
  };
  actual: {
    responseTimeP95: number;
    errorRate: number;
    throughputRps: number;
  };
}

export type { PerformanceConfig, SlaConfig, PerformanceMetric, SlaStatus };
