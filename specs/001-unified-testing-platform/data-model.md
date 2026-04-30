# Data Model: Unified Local Testing Platform

**Branch**: `001-unified-testing-platform` | **Date**: 2026-04-28

## Entities

### Session

Represents a complete testing engagement from document ingestion through all phases.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID) | PK, auto-generated | Unique session identifier |
| name | string | required | Human-readable session name |
| status | enum | required | Current state machine state |
| target_url | string | required | URL of application under test |
| config | JSON | required | Session configuration (browsers, thresholds, etc.) |
| created_at | datetime | required, auto | Session creation timestamp |
| updated_at | datetime | required, auto | Last modification timestamp |
| resumed_from | string (UUID) | nullable | Previous session ID if this is a resume |

**Status Values**: `INGESTION`, `GENERATION`, `FUNCTIONAL`, `PERFORMANCE`, `SECURITY`, `COMPLETE`

**State Transitions**:
```
INGESTION → GENERATION → FUNCTIONAL → PERFORMANCE → SECURITY → COMPLETE
```
Each forward transition requires a corresponding ApprovalGate record.

### ContextDocument

An uploaded file used to guide test generation.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID) | PK | Unique document identifier |
| session_id | string (UUID) | FK → Session, required | Owning session |
| filename | string | required | Original filename |
| format | enum | required | File format |
| content_hash | string | required | SHA-256 hash for dedup |
| extracted_text | text | nullable | Parsed text content |
| ingestion_status | enum | required | Processing state |
| test_case_count | integer | default 0 | Number of tests derived from this doc |
| created_at | datetime | required, auto | Upload timestamp |

**Format Values**: `PDF`, `DOCX`, `TXT`, `MARKDOWN`
**Ingestion Status Values**: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`

### TestCase

A single automated test with full lifecycle tracking.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID) | PK | Unique test case identifier |
| session_id | string (UUID) | FK → Session, required | Owning session |
| source_document_id | string (UUID) | FK → ContextDocument, nullable | Source document |
| phase | enum | required | Which testing phase this belongs to |
| name | string | required | Human-readable test name |
| description | text | nullable | What this test validates |
| definition | JSON | required | Structured test steps and assertions |
| approval_status | enum | required | Review state |
| tags | JSON (string[]) | default [] | Categorization tags |
| edit_history | JSON | default [] | List of edits with timestamps |
| created_at | datetime | required, auto | Generation timestamp |
| updated_at | datetime | required, auto | Last edit timestamp |

**Phase Values**: `FUNCTIONAL`, `PERFORMANCE`, `SECURITY`
**Approval Status Values**: `GENERATED`, `MODIFIED`, `APPROVED`, `REJECTED`, `SKIPPED`

### ApprovalGate

A checkpoint requiring human action before phase transition.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID) | PK | Unique gate identifier |
| session_id | string (UUID) | FK → Session, required | Owning session |
| phase | enum | required | Phase this gate guards |
| status | enum | required | Gate resolution state |
| resolved_by | string | nullable | User identifier who resolved |
| resolved_at | datetime | nullable | Resolution timestamp |
| comments | text | nullable | User comments on resolution |
| created_at | datetime | required, auto | Gate creation timestamp |

**Phase Values**: `FUNCTIONAL`, `PERFORMANCE`, `SECURITY`
**Status Values**: `PENDING`, `APPROVED`, `REJECTED`, `SKIPPED`

### ExecutionResult

The outcome of a single test run.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID) | PK | Unique result identifier |
| test_case_id | string (UUID) | FK → TestCase, required | Test that was run |
| session_id | string (UUID) | FK → Session, required | Owning session |
| status | enum | required | Execution outcome |
| duration_ms | integer | required | Execution time in milliseconds |
| browser | string | nullable | Browser engine used (functional tests) |
| screenshot_path | string | nullable | Path to failure screenshot |
| network_log | JSON | nullable | Captured request/response entries |
| error_message | text | nullable | Error details if failed/errored |
| artifacts | JSON | default {} | Additional output artifacts |
| started_at | datetime | required | Test start time |
| completed_at | datetime | required | Test end time |

**Status Values**: `PASSED`, `FAILED`, `ERROR`, `SKIPPED`, `TIMEOUT`

### SecurityFinding

A vulnerability detected during DAST scanning.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID) | PK | Unique finding identifier |
| session_id | string (UUID) | FK → Session, required | Owning session |
| scan_type | enum | required | Passive or active scan |
| severity | enum | required | Finding severity level |
| category | string | required | Vulnerability category (e.g., XSS, SQLi) |
| title | string | required | Short description |
| description | text | required | Detailed explanation |
| evidence | text | nullable | Request/response evidence |
| url | string | required | Affected URL |
| remediation | text | nullable | Suggested fix |
| created_at | datetime | required, auto | Detection timestamp |

**Scan Type Values**: `PASSIVE`, `ACTIVE`
**Severity Values**: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL`

### PerformanceMetric

A time-series measurement captured during load testing.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID) | PK | Unique metric identifier |
| session_id | string (UUID) | FK → Session, required | Owning session |
| timestamp | datetime | required | Measurement time |
| elapsed_seconds | integer | required | Seconds since load test start |
| concurrent_users | integer | required | Active virtual users |
| response_time_p50 | float | nullable | 50th percentile response time (ms) |
| response_time_p90 | float | nullable | 90th percentile response time (ms) |
| response_time_p95 | float | nullable | 95th percentile response time (ms) |
| response_time_p99 | float | nullable | 99th percentile response time (ms) |
| throughput_rps | float | nullable | Requests per second |
| error_rate | float | nullable | Error rate (0.0 - 1.0) |
| sla_status | enum | nullable | SLA compliance status |

**SLA Status Values**: `PASS`, `FAIL`, `NOT_CONFIGURED`

### AuditLog

Immutable record of all significant platform actions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID) | PK | Unique log entry identifier |
| session_id | string (UUID) | FK → Session, required | Owning session |
| action | enum | required | Type of action performed |
| actor | string | required | User or system component |
| details | JSON | nullable | Action-specific data |
| timestamp | datetime | required, auto | When action occurred |

**Action Values**: `SESSION_CREATED`, `SESSION_RESUMED`, `DOCUMENT_UPLOADED`, `DOCUMENT_INGESTED`, `TESTS_GENERATED`, `TEST_EDITED`, `TEST_APPROVED`, `TEST_REJECTED`, `PHASE_STARTED`, `PHASE_COMPLETED`, `GATE_APPROVED`, `GATE_REJECTED`, `GATE_SKIPPED`, `SESSION_COMPLETED`, `REPORT_EXPORTED`

## Relationships

```
Session 1──* ContextDocument
Session 1──* TestCase
Session 1──* ApprovalGate
Session 1──* ExecutionResult
Session 1──* SecurityFinding
Session 1──* PerformanceMetric
Session 1──* AuditLog

TestCase *──1 ContextDocument (optional source)
ExecutionResult *──1 TestCase
```

## Validation Rules

- Session.target_url MUST be a valid URL
- TestCase.definition MUST conform to the test definition JSON schema
- ApprovalGate.status MUST be resolved before session can advance to next phase
- ExecutionResult.duration_ms MUST be >= 0
- SecurityFinding.severity MUST be one of the five defined levels
- PerformanceMetric.elapsed_seconds MUST be monotonically increasing within a session
- AuditLog entries are immutable (INSERT only, no UPDATE or DELETE)
