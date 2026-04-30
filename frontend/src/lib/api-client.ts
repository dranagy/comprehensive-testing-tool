import type {
  Session,
  SessionConfig,
  TestCase,
  TestCaseDefinition,
  ApprovalGate,
  SecurityFinding,
  AuditEntry,
  ExecutionSummary,
  RunProgressEvent,
  TestPhase,
  Severity,
  PerfMetric,
  ConfigUpdateResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3456/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API error ${res.status}`);
  }
  return res.json();
}

// Sessions
export const sessions = {
  list: () => request<Session[]>("/sessions"),
  get: (id: string) => request<Session>(`/sessions/${id}`),
  create: (data: { name?: string; targetUrl: string; config?: SessionConfig }) =>
    request<Session>("/sessions", { method: "POST", body: JSON.stringify(data) }),
  resume: (id: string) => request<Session>(`/sessions/${id}/resume`, { method: "POST" }),
  advance: (id: string) => request<Session>(`/sessions/${id}/advance`, { method: "POST" }),
  export: (id: string) => request<Record<string, unknown>>(`/sessions/${id}/export`),
};

// Ingest
export const ingest = {
  upload: async (sessionId: string, files: File[]) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    const res = await fetch(`${API_BASE}/ingest/${sessionId}/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },
};

// Generate
export const generate = {
  byPhase: (sessionId: string, phase: TestPhase) =>
    request<{ phase: string; generatedCount: number }>(`/generate/${sessionId}/${phase}`, { method: "POST" }),
  all: (sessionId: string) =>
    request<{ phases: Array<{ phase: string; generatedCount: number }> }>(`/generate/${sessionId}`, { method: "POST" }),
};

// Review
export const review = {
  listTestCases: (sessionId: string, params?: { phase?: string; status?: string; tags?: string }) => {
    const qs = new URLSearchParams();
    if (params?.phase) qs.set("phase", params.phase);
    if (params?.status) qs.set("status", params.status);
    if (params?.tags) qs.set("tags", params.tags);
    const query = qs.toString();
    return request<TestCase[]>(`/review/${sessionId}/test-cases${query ? `?${query}` : ""}`);
  },
  getTestCase: (sessionId: string, testId: string) =>
    request<TestCase>(`/review/${sessionId}/test-cases/${testId}`),
  updateTestCase: (sessionId: string, testId: string, definition: TestCaseDefinition) =>
    request<TestCase>(`/review/${sessionId}/test-cases/${testId}`, {
      method: "PUT",
      body: JSON.stringify({ definition }),
    }),
  approve: (sessionId: string, data: { phase?: string; testIds?: string[] }) =>
    request<{ approved: number }>(`/review/${sessionId}/approve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  reject: (sessionId: string, testId: string, reason?: string) =>
    request<{ id: string; status: string }>(`/review/${sessionId}/test-cases/${testId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  getGates: (sessionId: string) =>
    request<ApprovalGate[]>(`/review/${sessionId}/gates`),
  resolveGate: (sessionId: string, phase: string, action: "approve" | "reject" | "skip", comments?: string) =>
    request<ApprovalGate>(`/review/${sessionId}/gates/${phase}`, {
      method: "POST",
      body: JSON.stringify({ action, comments }),
    }),
};

// Run
export const run = {
  start: (sessionId: string, options: {
    testIds?: string[];
    phase?: string;
    failed?: boolean;
    tags?: string[];
    browser?: string;
    parallel?: number;
    timeout?: number;
    dryRun?: boolean;
  }) =>
    request<{ runId: string; testCount: number; status: string; dryRun?: boolean; tests?: unknown[] }>(
      `/run/${sessionId}/run`,
      { method: "POST", body: JSON.stringify(options) },
    ),
  cancel: (sessionId: string, runId: string) =>
    request<{ cancelled: boolean }>(`/run/${sessionId}/run/${runId}/cancel`, { method: "POST" }),
};

// Reports
export const reports = {
  summary: (sessionId: string) =>
    request<{
      session: { id: string; name: string };
      testCases: { functional: number; performance: number; security: number; total: number };
      execution: ExecutionSummary;
      passRate: string;
      security: { findings: number; bySeverity: Record<Severity, number> };
    }>(`/reports/${sessionId}/summary`),
  functional: (sessionId: string, status?: string) => {
    const qs = status ? `?status=${status}` : "";
    return request<{
      total: number;
      summary: ExecutionSummary;
      results: Array<{
        id: string;
        name: string;
        status: string;
        durationMs: number | null;
        browser: string | null;
        errorMessage: string | null;
      }>;
    }>(`/reports/${sessionId}/functional${qs}`);
  },
  performance: (sessionId: string) =>
    request<{ totalResults: number; metrics: PerfMetric[] }>(`/reports/${sessionId}/performance`),
  security: (sessionId: string, severity?: string) => {
    const qs = severity ? `?severity=${severity}` : "";
    return request<{
      totalFindings: number;
      bySeverity: Record<Severity, number>;
      findings: SecurityFinding[];
    }>(`/reports/${sessionId}/security${qs}`);
  },
  audit: (sessionId: string, action?: string) => {
    const qs = action ? `?action=${action}` : "";
    return request<{
      sessionId: string;
      totalEntries: number;
      entries: AuditEntry[];
    }>(`/reports/${sessionId}/audit${qs}`);
  },
};

// Config
export const config = {
  get: () => request<Record<string, unknown>>("/config"),
  update: (cfg: Record<string, unknown>) =>
    request<ConfigUpdateResponse>("/config", { method: "PUT", body: JSON.stringify(cfg) }),
  reset: (target: string) =>
    request<{ reset: boolean }>("/config/reset", { method: "POST", body: JSON.stringify({ target }) }),
};

// Health
export const health = {
  check: () => request<{ status: string; timestamp: string }>("/health"),
};

// WebSocket hook helper
export function connectRunProgress(
  runId: string,
  onProgress: (event: RunProgressEvent) => void,
  onError?: (error: Event) => void,
): WebSocket {
  const wsBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3456").replace(/^http/, "ws");
  const ws = new WebSocket(`${wsBase}/ws?runId=${runId}`);
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data) as RunProgressEvent;
    onProgress(data);
  };
  if (onError) ws.onerror = onError;
  return ws;
}
