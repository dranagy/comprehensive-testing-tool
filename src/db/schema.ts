export const SCHEMA_VERSION = 1;

export const CREATE_SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('INGESTION','GENERATION','FUNCTIONAL','PERFORMANCE','SECURITY','COMPLETE')),
  target_url TEXT NOT NULL,
  config TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resumed_from TEXT
);`;

export const CREATE_CONTEXT_DOCUMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS context_documents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  filename TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('PDF','DOCX','TXT','MARKDOWN')),
  content_hash TEXT NOT NULL,
  extracted_text TEXT,
  ingestion_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (ingestion_status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
  test_case_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_TEST_CASES_TABLE = `
CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  source_document_id TEXT REFERENCES context_documents(id),
  phase TEXT NOT NULL CHECK (phase IN ('FUNCTIONAL','PERFORMANCE','SECURITY')),
  name TEXT NOT NULL,
  description TEXT,
  definition TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (approval_status IN ('GENERATED','MODIFIED','APPROVED','REJECTED','SKIPPED')),
  tags TEXT NOT NULL DEFAULT '[]',
  edit_history TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_APPROVAL_GATES_TABLE = `
CREATE TABLE IF NOT EXISTS approval_gates (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  phase TEXT NOT NULL CHECK (phase IN ('FUNCTIONAL','PERFORMANCE','SECURITY')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','SKIPPED')),
  resolved_by TEXT,
  resolved_at TEXT,
  comments TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_EXECUTION_RESULTS_TABLE = `
CREATE TABLE IF NOT EXISTS execution_results (
  id TEXT PRIMARY KEY,
  test_case_id TEXT NOT NULL REFERENCES test_cases(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  status TEXT NOT NULL CHECK (status IN ('PASSED','FAILED','ERROR','SKIPPED','TIMEOUT')),
  duration_ms INTEGER NOT NULL,
  browser TEXT,
  screenshot_path TEXT,
  network_log TEXT,
  error_message TEXT,
  artifacts TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL
);`;

export const CREATE_SECURITY_FINDINGS_TABLE = `
CREATE TABLE IF NOT EXISTS security_findings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  scan_type TEXT NOT NULL CHECK (scan_type IN ('PASSIVE','ACTIVE')),
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW','INFORMATIONAL')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT,
  url TEXT NOT NULL,
  remediation TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_PERFORMANCE_METRICS_TABLE = `
CREATE TABLE IF NOT EXISTS performance_metrics (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  timestamp TEXT NOT NULL,
  elapsed_seconds INTEGER NOT NULL,
  concurrent_users INTEGER NOT NULL,
  response_time_p50 REAL,
  response_time_p90 REAL,
  response_time_p95 REAL,
  response_time_p99 REAL,
  throughput_rps REAL,
  error_rate REAL,
  sla_status TEXT DEFAULT 'NOT_CONFIGURED' CHECK (sla_status IN ('PASS','FAIL','NOT_CONFIGURED'))
);`;

export const CREATE_AUDIT_LOG_TABLE = `
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_SCHEMA_VERSION_TABLE = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const ALL_TABLES = [
  CREATE_SCHEMA_VERSION_TABLE,
  CREATE_SESSIONS_TABLE,
  CREATE_CONTEXT_DOCUMENTS_TABLE,
  CREATE_TEST_CASES_TABLE,
  CREATE_APPROVAL_GATES_TABLE,
  CREATE_EXECUTION_RESULTS_TABLE,
  CREATE_SECURITY_FINDINGS_TABLE,
  CREATE_PERFORMANCE_METRICS_TABLE,
  CREATE_AUDIT_LOG_TABLE,
];
