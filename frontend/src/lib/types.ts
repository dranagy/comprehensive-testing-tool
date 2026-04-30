export type Phase = "INGESTION" | "GENERATION" | "FUNCTIONAL" | "PERFORMANCE" | "SECURITY" | "COMPLETE";
export type TestPhase = "FUNCTIONAL" | "PERFORMANCE" | "SECURITY";
export type ApprovalStatus = "GENERATED" | "MODIFIED" | "APPROVED" | "REJECTED" | "SKIPPED";
export type GateStatus = "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
export type ExecutionStatus = "PASSED" | "FAILED" | "ERROR" | "SKIPPED" | "TIMEOUT";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
export type BrowserType = "chromium" | "firefox" | "webkit";

export interface Session {
  id: string;
  name: string;
  status: Phase;
  targetUrl: string;
  config: SessionConfig;
  createdAt: string;
  updatedAt: string;
  resumedFrom: string | null;
  testCounts?: { functional: number; performance: number; security: number };
  pendingGates?: ApprovalGate[];
  executionSummary?: ExecutionSummary;
}

export interface SessionConfig {
  browsers: BrowserType[];
  performance?: PerformanceConfig;
  security?: SecurityConfig;
  output?: OutputConfig;
}

export interface PerformanceConfig {
  virtualUsers: number;
  rampUpSeconds: number;
  durationSeconds: number;
  sla?: SlaConfig;
}

export interface SlaConfig {
  responseTimeP95Ms: number;
  errorRateMax: number;
  throughputMinRps: number;
}

export interface SecurityConfig {
  zapPath: string;
  passiveScan: boolean;
  activeScan: boolean;
  severityThreshold: Severity;
}

export interface OutputConfig {
  format: string;
  screenshots: boolean;
  networkLogs: boolean;
}

export interface TestCase {
  id: string;
  sessionId: string;
  sourceDocumentId: string | null;
  phase: TestPhase;
  name: string;
  description: string;
  definition: TestCaseDefinition;
  approvalStatus: ApprovalStatus;
  tags: string[];
  editHistory: EditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TestCaseDefinition {
  steps: TestStep[];
  assertions: TestAssertion[];
}

export interface TestStep {
  action: "click" | "type" | "navigate" | "wait" | "select" | "submit";
  selector: string;
  value?: string;
  description: string;
}

export interface TestAssertion {
  type: "visible" | "text" | "url" | "status" | "attribute";
  expected: string;
  selector?: string;
}

export interface EditEntry {
  timestamp: string;
  field: string;
  previousValue: unknown;
  newValue: unknown;
}

export interface ApprovalGate {
  id: string;
  sessionId: string;
  phase: TestPhase;
  status: GateStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  comments: string | null;
  createdAt: string;
}

export interface ExecutionResult {
  id: string;
  testCaseId: string;
  sessionId: string;
  status: ExecutionStatus;
  durationMs: number;
  browser: BrowserType | null;
  screenshotPath: string | null;
  networkLog: unknown[] | null;
  errorMessage: string | null;
  artifacts: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
}

export interface ExecutionSummary {
  total: number;
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
}

export interface SecurityFinding {
  id: string;
  sessionId: string;
  scanType: "PASSIVE" | "ACTIVE";
  severity: Severity;
  category: string;
  title: string;
  description: string;
  evidence: string | null;
  url: string;
  remediation: string | null;
  createdAt: string;
}

export interface PerfMetric {
  testCaseId: string;
  status: string;
  durationMs: number;
  responseTimeP50?: number | null;
  responseTimeP90?: number | null;
  responseTimeP95?: number | null;
  responseTimeP99?: number | null;
  throughputRps?: number | null;
  errorRate?: number | null;
  concurrentUsers?: number | null;
  slaStatus?: string;
}

export interface ConfigUpdateResponse {
  updated: boolean;
  config: Record<string, unknown>;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details: Record<string, unknown> | null;
}

export interface RunProgressEvent {
  runId: string;
  testCaseId?: string;
  status: "running" | "passed" | "failed" | "errored" | "skipped" | "completed" | "error";
  message?: string;
  percentage?: number;
  summary?: ExecutionSummary;
}
