// Shared type definitions for the Comprehensive Testing Tool

// --- Enums ---

export type Phase = "INGESTION" | "GENERATION" | "FUNCTIONAL" | "PERFORMANCE" | "SECURITY" | "COMPLETE";

export type TestPhase = "FUNCTIONAL" | "PERFORMANCE" | "SECURITY";

export type ApprovalStatus = "GENERATED" | "MODIFIED" | "APPROVED" | "REJECTED" | "SKIPPED";

export type GateStatus = "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";

export type ExecutionStatus = "PASSED" | "FAILED" | "ERROR" | "SKIPPED" | "TIMEOUT";

export type DocumentFormat = "PDF" | "DOCX" | "TXT" | "MARKDOWN";

export type IngestionStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type BrowserType = "chromium" | "firefox" | "webkit";

export type OutputFormat = "json" | "terminal" | "junit";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";

export type ScanType = "PASSIVE" | "ACTIVE";

export type SlaStatus = "PASS" | "FAIL" | "NOT_CONFIGURED";

export type AuditAction =
  | "SESSION_CREATED"
  | "SESSION_RESUMED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_INGESTED"
  | "TESTS_GENERATED"
  | "TEST_EDITED"
  | "TEST_APPROVED"
  | "TEST_REJECTED"
  | "PHASE_STARTED"
  | "PHASE_COMPLETED"
  | "GATE_APPROVED"
  | "GATE_REJECTED"
  | "GATE_SKIPPED"
  | "SESSION_COMPLETED"
  | "REPORT_EXPORTED";

// --- Entities ---

export interface Session {
  id: string;
  name: string;
  status: Phase;
  targetUrl: string;
  config: SessionConfig;
  createdAt: string;
  updatedAt: string;
  resumedFrom: string | null;
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
  format: OutputFormat;
  screenshots: boolean;
  networkLogs: boolean;
}

export interface ContextDocument {
  id: string;
  sessionId: string;
  filename: string;
  format: DocumentFormat;
  contentHash: string;
  extractedText: string | null;
  ingestionStatus: IngestionStatus;
  testCaseCount: number;
  createdAt: string;
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
  networkLog: NetworkEntry[] | null;
  errorMessage: string | null;
  artifacts: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
}

export interface NetworkEntry {
  method: string;
  url: string;
  status: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  timing: number;
}

export interface SecurityFinding {
  id: string;
  sessionId: string;
  scanType: ScanType;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  evidence: string | null;
  url: string;
  remediation: string | null;
  createdAt: string;
}

export interface PerformanceMetric {
  id: string;
  sessionId: string;
  timestamp: string;
  elapsedSeconds: number;
  concurrentUsers: number;
  responseTimeP50: number | null;
  responseTimeP90: number | null;
  responseTimeP95: number | null;
  responseTimeP99: number | null;
  throughputRps: number | null;
  errorRate: number | null;
  slaStatus: SlaStatus;
}

export interface AuditLogEntry {
  id: string;
  sessionId: string;
  action: AuditAction;
  actor: string;
  details: Record<string, unknown> | null;
  timestamp: string;
}

// --- Module Interface Types ---

export interface ModuleContext {
  sessionId: string;
  targetUrl: string;
  config: SessionConfig;
  db: DatabaseConnection;
  logger: Logger;
  reportProgress: (update: ProgressUpdate) => void;
}

export interface ProgressUpdate {
  testCaseId?: string;
  status: "running" | "passed" | "failed" | "errored" | "skipped";
  message?: string;
  percentage?: number;
}

export interface ExecutionOptions {
  parallel?: number;
  timeout?: number;
  dryRun?: boolean;
  browsers?: BrowserType[];
  filter?: string[];
  onProgress?: (update: ProgressUpdate) => void;
}

// Placeholder interfaces — will be properly typed in their modules
export interface DatabaseConnection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prepare(sql: string): any;
  exec(sql: string): void;
  close(): void;
}

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}
